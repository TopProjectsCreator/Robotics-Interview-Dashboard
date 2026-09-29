//! Build a coarse assembly overview plus exact, on-demand geometry tiles.

#[global_allocator]
static ALLOC: cad_alloc::MiMalloc = cad_alloc::MiMalloc;

use cad_export::{self, Options as ExportOptions};
use cad_ir::material::ImageId;
use cad_ir::{
    GeometryId, MaterialId, Node, NodeId, Scene,
    math::Aabb,
    scene::Instance,
};
use std::{
    collections::{HashMap, HashSet},
    env,
    fs::{self, File},
    io::{BufWriter, Write},
    path::{Path, PathBuf},
    process::ExitCode,
    time::Instant,
};

const DEFAULT_FINE_SAG_MM: f64 = 0.01;
const DEFAULT_FINE_ANGLE_DEG: f64 = 8.0;
const DEFAULT_OVERVIEW_SAG_MM: f64 = 0.8;
const DEFAULT_OVERVIEW_ANGLE_DEG: f64 = 20.0;

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("cadprogressive: {message}");
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<(), String> {
    let mut args = env::args().skip(1);
    let input = args.next().map(PathBuf::from)
        .ok_or_else(|| "usage: cadprogressive <input.x_t> <output-directory> [options]".to_string())?;
    let output_dir = args.next().map(PathBuf::from)
        .ok_or_else(|| "usage: cadprogressive <input.x_t> <output-directory> [options]".to_string())?;

    let mut fine_sag = DEFAULT_FINE_SAG_MM;
    let mut fine_angle = DEFAULT_FINE_ANGLE_DEG;
    let mut overview_sag = DEFAULT_OVERVIEW_SAG_MM;
    let mut overview_angle = DEFAULT_OVERVIEW_ANGLE_DEG;
    while let Some(arg) = args.next() {
        let mut value = || args_next(&mut args, &arg);
        match arg.as_str() {
            "--sag" => fine_sag = parse_number(&value()?, "--sag")?,
            "--angle" => fine_angle = parse_number(&value()?, "--angle")?,
            "--overview-sag" => overview_sag = parse_number(&value()?, "--overview-sag")?,
            "--overview-angle" => overview_angle = parse_number(&value()?, "--overview-angle")?,
            other => return Err(format!("unknown option {other:?}")),
        }
    }
    if [fine_sag, fine_angle, overview_sag, overview_angle]
        .iter()
        .any(|v| !v.is_finite() || *v <= 0.0)
    {
        return Err("tolerances must be finite positive numbers".into());
    }

    let started = Instant::now();
    let tiles_dir = output_dir.join("tiles");
    fs::create_dir_all(&tiles_dir).map_err(|e| format!("creating {}: {e}", tiles_dir.display()))?;

    eprintln!("Reading and meshing the coarse overview…");
    let (mut overview, overview_report) = read_and_mesh(&input, overview_sag, overview_angle)?;
    let overview_failed_geometry_names: HashSet<String> = overview_report.failed
        .iter()
        .map(|failure| failure.geometry.clone())
        .collect();

    eprintln!("Reading and meshing exact-detail geometry…");
    // The high-detail report is the completeness gate for every exact tile.
    let (mut scene, report) = read_and_mesh_with_report(&input, fine_sag, fine_angle)?;
    if report.faces_ok == 0 {
        return Err("fine conversion produced no geometry".into());
    }

    attach_appearance(&mut scene);
    attach_appearance(&mut overview);
    if overview.geometry.len() != scene.geometry.len() {
        return Err("coarse and exact conversions returned different geometry counts".into());
    }
    let mut exact_overview_fallbacks = 0usize;
    let mut unresolved_coarse_failures = overview_failed_geometry_names.clone();
    for (geometry_index, coarse_geometry) in overview.geometry.iter_mut().enumerate() {
        if !overview_failed_geometry_names.contains(&coarse_geometry.name) {
            continue;
        }
        let exact_geometry = &scene.geometry[geometry_index];
        if exact_geometry.name != coarse_geometry.name {
            return Err(format!(
                "coarse and exact geometry ordering differs at body {geometry_index}"
            ));
        }
        let Some(exact_mesh) = exact_geometry.mesh.as_ref().filter(|mesh| !mesh.is_empty()) else {
            return Err(format!(
                "body {:?} missed coarse faces and has no exact mesh fallback",
                coarse_geometry.name
            ));
        };
        let mut exact_mesh = exact_mesh.clone();
        for part in &mut exact_mesh.parts {
            let fine_material = scene.materials.get(part.material as usize)
                .ok_or_else(|| format!("body {:?} references missing material {}", coarse_geometry.name, part.material))?;
            let coarse_material = overview.materials.iter()
                .position(|material| material == fine_material)
                .ok_or_else(|| format!("body {:?} has a material that cannot be matched in the overview", coarse_geometry.name))?;
            part.material = coarse_material as u32;
        }
        coarse_geometry.mesh = Some(exact_mesh);
        exact_overview_fallbacks += 1;
        unresolved_coarse_failures.remove(&coarse_geometry.name);
    }
    if !unresolved_coarse_failures.is_empty() {
        return Err(format!(
            "could not replace failed coarse bodies with exact geometry: {}",
            unresolved_coarse_failures.into_iter().collect::<Vec<_>>().join(", "),
        ));
    }
    for node in &mut overview.nodes {
        if let Some(geometry) = node.geometry {
            node.name = tile_node_name(geometry.index());
        }
    }
    let overview_path = output_dir.join("overview.glb");
    let overview_bytes = cad_export::glb::write_file(
        &overview,
        &ExportOptions::compact(),
        &overview_path,
    )
    .map_err(|e| format!("writing overview GLB: {e}"))?;
    drop(overview);

    let instances = scene.instances();
    let export_options = ExportOptions::default();
    let mut manifest_tiles = Vec::new();
    let mut detail_bytes = 0u64;
    let mut detail_triangles = 0usize;

    for geometry_index in 0..scene.geometry.len() {
        let geometry = &scene.geometry[geometry_index];
        let Some(mesh) = geometry.mesh.as_ref().filter(|mesh| !mesh.is_empty()) else {
            continue;
        };
        let geometry_instances: Vec<Instance> = instances.iter()
            .copied()
            .filter(|instance| instance.geometry.index() == geometry_index)
            .collect();
        if geometry_instances.is_empty() {
            return Err(format!(
                "body {:?} has meshed source faces but no scene instance",
                geometry.name
            ));
        }

        let id = format!("g{geometry_index}");
        let bounds = tile_bounds(mesh.bounds(), &geometry_instances, &export_options);
        if bounds.is_empty() {
            continue;
        }
        let tile_scene = scene_for_geometry(&scene, geometry_index, &geometry_instances)?;
        let tile_path = tiles_dir.join(format!("{id}.glb"));
        let bytes = cad_export::glb::write_file(&tile_scene, &export_options, &tile_path)
            .map_err(|e| format!("writing detail tile {id}: {e}"))?;
        let triangles = mesh.triangle_count();
        detail_bytes = detail_bytes.saturating_add(bytes);
        detail_triangles = detail_triangles.saturating_add(triangles);
        manifest_tiles.push(format!(
            "{{\"id\":\"{id}\",\"bytes\":{bytes},\"triangles\":{triangles},\"center\":[{:.9},{:.9},{:.9}],\"radius\":{:.9}}}",
            bounds.centre().x,
            bounds.centre().y,
            bounds.centre().z,
            bounds.diagonal() * 0.5,
        ));
    }

    if manifest_tiles.is_empty() {
        return Err("fine conversion produced no detail tiles".into());
    }
    if detail_triangles != report.triangles {
        return Err(format!(
            "detail tiles contain {detail_triangles} triangles, but the exact conversion meshed {}",
            report.triangles
        ));
    }

    let manifest_path = output_dir.join("manifest.json");
    let mut manifest = BufWriter::new(
        File::create(&manifest_path).map_err(|e| format!("creating {}: {e}", manifest_path.display()))?,
    );
    writeln!(
        manifest,
        "{{\"version\":1,\"overviewBytes\":{overview_bytes},\"detailBytes\":{detail_bytes},\"triangles\":{detail_triangles},\"tiles\":[{}]}}",
        manifest_tiles.join(","),
    ).map_err(|e| format!("writing manifest: {e}"))?;
    manifest.flush().map_err(|e| format!("flushing manifest: {e}"))?;

    println!(
        "{} -> progressive overview ({:.2} MB, {} exact-body fallbacks), {} exact tiles ({:.2} MB), {} bodies, {}/{} faces, {} triangles in {:.1} s",
        input.display(),
        overview_bytes as f64 / 1e6,
        exact_overview_fallbacks,
        manifest_tiles.len(),
        detail_bytes as f64 / 1e6,
        scene.geometry.len(),
        report.faces_ok,
        report.faces_ok + report.failed.len(),
        detail_triangles,
        started.elapsed().as_secs_f64(),
    );
    Ok(())
}

fn args_next(args: &mut impl Iterator<Item = String>, option: &str) -> Result<String, String> {
    args.next().ok_or_else(|| format!("{option} needs a value"))
}

fn parse_number(value: &str, option: &str) -> Result<f64, String> {
    value.parse::<f64>().map_err(|_| format!("{option} wants a number"))
}

fn read_and_mesh(
    input: &Path,
    sag: f64,
    angle_deg: f64,
) -> Result<(Scene, cad_tess::Report), String> {
    let mut options = cad_convert::Options::default();
    options.quality.linear_deflection = sag;
    options.quality.relative = false;
    options.quality.angular_deflection = angle_deg.to_radians();
    let mut scene = cad_convert::read(input, &options).map_err(|e| e.to_string())?;
    let quality = cad_tess::Options {
        release_brep: true,
        ..options.quality
    };
    let report = cad_tess::tessellate_scene(&mut scene, &quality);
    if report.cancelled {
        return Err("tessellation was cancelled".into());
    }
    Ok((scene, report))
}

// The exact conversion is the completeness gate for the progressive preview.
fn read_and_mesh_with_report(
    input: &Path,
    sag: f64,
    angle_deg: f64,
) -> Result<(Scene, cad_tess::Report), String> {
    let (scene, report) = read_and_mesh(input, sag, angle_deg)?;
    if !report.failed.is_empty() {
        let examples = report.failed.iter()
            .take(3)
            .map(|failure| format!("{} {:?}: {}", failure.geometry, failure.face, failure.reason))
            .collect::<Vec<_>>()
            .join("; ");
        return Err(format!(
            "tessellation missed {} of {} faces ({examples})",
            report.failed.len(),
            report.faces_ok + report.failed.len(),
        ));
    }
    Ok((scene, report))
}

fn tile_node_name(index: usize) -> String {
    format!("__cad_lod_g{index}")
}

fn tile_bounds(
    local: Aabb,
    instances: &[Instance],
    export: &ExportOptions,
) -> Aabb {
    instances.iter().fold(Aabb::EMPTY, |bounds, instance| {
        let world = local.transformed(&instance.transform);
        bounds.union(&world.transformed(&export.root_transform()))
    })
}

fn scene_for_geometry(
    source: &Scene,
    geometry_index: usize,
    instances: &[Instance],
) -> Result<Scene, String> {
    let mut geometry = source.geometry[geometry_index].clone();
    geometry.brep = None;
    let mut materials = Vec::new();
    let mut material_map = HashMap::<u32, u32>::new();
    let mut images = Vec::new();
    let mut image_map = HashMap::<u32, u32>::new();

    let mut referenced_materials = Vec::new();
    if let Some(mesh) = &geometry.mesh {
        for part in &mesh.parts {
            referenced_materials.push(part.material);
        }
    }
    if let Some(material) = geometry.material {
        referenced_materials.push(material.0);
    }
    referenced_materials.extend(
        geometry.face_materials.iter().flatten().map(|material| material.0),
    );
    for instance in instances {
        if let Some(material) = instance.material {
            referenced_materials.push(material.0);
        }
    }
    referenced_materials.sort_unstable();
    referenced_materials.dedup();

    for old_id in referenced_materials {
        let source_material = source.materials.get(old_id as usize)
            .ok_or_else(|| format!("geometry references missing material {old_id}"))?;
        let mut material = source_material.clone();
        for image_id in [
            material.textures.base_colour,
            material.textures.normal,
        ].into_iter().flatten() {
            if !image_map.contains_key(&image_id.0) {
                let image = source.images.get(image_id.index())
                    .ok_or_else(|| format!("material references missing image {}", image_id.0))?;
                let local_id = images.len() as u32;
                images.push(image.clone());
                image_map.insert(image_id.0, local_id);
            }
        }
        if let Some(image) = material.textures.base_colour {
            material.textures.base_colour = Some(ImageId(*image_map.get(&image.0).unwrap()));
        }
        if let Some(image) = material.textures.normal {
            material.textures.normal = Some(ImageId(*image_map.get(&image.0).unwrap()));
        }
        let local_id = materials.len() as u32;
        material_map.insert(old_id, local_id);
        materials.push(material);
    }
    if materials.is_empty() {
        materials.push(cad_ir::Material::unknown());
    }

    if let Some(mesh) = geometry.mesh.as_mut() {
        for part in &mut mesh.parts {
            part.material = *material_map.get(&part.material).unwrap_or(&0);
        }
    }
    if let Some(material) = geometry.material {
        geometry.material = Some(MaterialId(*material_map.get(&material.0).unwrap_or(&0)));
    }
    for material in &mut geometry.face_materials {
        *material = material.map(|id| MaterialId(*material_map.get(&id.0).unwrap_or(&0)));
    }

    let mut nodes = Vec::with_capacity(instances.len());
    let mut roots = Vec::with_capacity(instances.len());
    for instance in instances {
        let id = NodeId(nodes.len() as u32);
        let material = instance.material.map(|old| {
            MaterialId(*material_map.get(&old.0).unwrap_or(&0))
        });
        nodes.push(Node {
            name: tile_node_name(geometry_index),
            transform: instance.transform,
            children: Vec::new(),
            geometry: Some(GeometryId(0)),
            material,
        });
        roots.push(id);
    }

    Ok(Scene {
        nodes,
        roots,
        geometry: vec![geometry],
        materials,
        images,
        meta: source.meta.clone(),
    })
}

fn attach_appearance(scene: &mut Scene) {
    let _ = cad_ir::material_resolve::attach_appearance_textures(scene);
    let textured: Vec<u32> = scene.materials.iter()
        .enumerate()
        .filter(|(_, material)| !material.textures.is_empty())
        .map(|(index, _)| index as u32)
        .collect();
    if textured.is_empty() {
        return;
    }
    for geometry in &mut scene.geometry {
        if let Some(mesh) = geometry.mesh.as_mut() {
            if mesh.uvs.is_empty() && mesh.parts.iter().any(|part| textured.contains(&part.material)) {
                cad_ir::uv::project(mesh);
            }
        }
    }
}