import { useEffect, useRef, useState } from "react";

import { attachTrackpadPan } from "../lib/trackpadPan";

import { parseThreeMf, THREE_MF_MAX_TRIANGLES } from "../lib/threeMf";

type CadThreeMfViewerProps = {
  name: string;
  src: string;
  height?: number;
};

/** Mirrors the OCCT viewer's cap so a huge print cannot lock up the tab. */
const MAX_TRIANGLES = Math.min(THREE_MF_MAX_TRIANGLES, 3_000_000);

/**
 * Renders a 3MF archive inline. A 3MF is a ZIP of XML mesh data, so unlike STEP
 * or IGES it needs no CAD kernel: the archive is unzipped in the browser and the
 * triangles go straight into a three.js scene. Nothing is sent to the server.
 */
export function CadThreeMfViewer({ name, src, height = 420 }: CadThreeMfViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let active = true;
    let abortController: AbortController | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeHandler: (() => void) | null = null;
    let renderer: import("three").WebGLRenderer | null = null;
    let controls: import("three/addons/controls/OrbitControls.js").OrbitControls | null = null;
    let detachTrackpadPan: (() => void) | null = null;
    let scene: import("three").Scene | null = null;
    const geometries: import("three").BufferGeometry[] = [];
    const materials: import("three").Material[] = [];

    const fail = (reason: string) => {
      if (!active) return;
      setFailed(reason);
      setReady(false);
    };

    setFailed(null);
    setReady(false);

    void (async () => {
      try {
        const [THREE, { OrbitControls }] = await Promise.all([
          import("three"),
          import("three/addons/controls/OrbitControls.js"),
        ]);

        abortController = new AbortController();
        let bytes: Uint8Array;
        try {
          const response = await fetch(src, { signal: abortController.signal });
          if (!response.ok) throw new Error("download failed");
          bytes = new Uint8Array(await response.arrayBuffer());
        } catch {
          fail("This 3MF file could not be downloaded.");
          return;
        }
        if (!active) return;

        let parsed: ReturnType<typeof parseThreeMf>;
        try {
          parsed = parseThreeMf(bytes);
        } catch (error) {
          fail(
            error instanceof Error
              ? error.message
              : "This 3MF file could not be parsed.",
          );
          return;
        }
        if (!active) return;

        if (parsed.triangleCount > MAX_TRIANGLES) {
          fail(
            `This model has ${Math.round(parsed.triangleCount / 1000)}k triangles, too many to preview in the browser. Download the file instead.`,
          );
          return;
        }

        const width = Math.max(host.clientWidth, 320);
        const viewerScene = new THREE.Scene();
        scene = viewerScene;
        const camera = new THREE.PerspectiveCamera(
          40,
          width / height,
          0.001,
          1_000_000,
        );
        const viewerRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer = viewerRenderer;
        viewerRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        viewerRenderer.setSize(width, height, false);
        viewerRenderer.outputColorSpace = THREE.SRGBColorSpace;
        viewerRenderer.domElement.setAttribute("aria-label", `3D preview of ${name}`);
        viewerRenderer.domElement.setAttribute("role", "img");
        viewerRenderer.domElement.tabIndex = 0;
        // Without this the browser claims two-finger gestures for page scroll,
        // so OrbitControls never receives them.
        viewerRenderer.domElement.style.touchAction = "none";
        host.appendChild(viewerRenderer.domElement);

        viewerScene.add(new THREE.AmbientLight(0xffffff, 1.6));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(4, 6, 8);
        viewerScene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
        fillLight.position.set(-5, -3, -4);
        viewerScene.add(fillLight);

        // Registered before OrbitControls so this handler sees the wheel event
        // first and can consume the pan gestures OrbitControls would zoom.
        detachTrackpadPan = attachTrackpadPan(viewerRenderer.domElement, () => viewerControls);
        const viewerControls = new OrbitControls(camera, viewerRenderer.domElement);
        // Pan in the camera's screen plane; panning in the ground plane is
        // disorienting for a part floating in space.
        viewerControls.screenSpacePanning = true;
        controls = viewerControls;
        viewerControls.enableDamping = true;
        viewerControls.dampingFactor = 0.08;

        const resize = () => {
          if (!active) return;
          const nextWidth = Math.max(host.clientWidth, 320);
          camera.aspect = nextWidth / height;
          camera.updateProjectionMatrix();
          viewerRenderer.setSize(nextWidth, height, false);
        };
        resizeHandler = resize;
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(host);
        }
        window.addEventListener("resize", resize);

        // 3MF units vary per file; scaling to millimetres keeps the scene the
        // same size as the other viewers regardless of the source unit.
        const scale = parsed.unitScaleToMillimetres;
        const group = new THREE.Group();
        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;

        for (const mesh of parsed.meshes) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
          geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
          const meshColors = mesh.colors;
          if (meshColors && meshColors.length === mesh.indices.length * 4) {
            geometry.setAttribute(
              "color",
              new THREE.BufferAttribute(
                new Float32Array(
                  Array.from({ length: meshColors.length }, (_, index) =>
                    meshColors[index] / 255,
                  ),
                ),
                4,
              ),
            );
          }
          geometry.computeVertexNormals();
          geometry.computeBoundingSphere();
          const radius = geometry.boundingSphere?.radius ?? 0;
          if (!Number.isFinite(radius) || radius <= 0) {
            geometry.dispose();
            continue;
          }
          geometries.push(geometry);
          // 3MF can carry a colour per vertex; without one, fall back to the
          // house teal so the model still reads as a solid.
          const hasColors = geometry.getAttribute("color") !== undefined;
          const material = hasColors
            ? new THREE.MeshStandardMaterial({
              vertexColors: true,
              metalness: 0.18,
              roughness: 0.55,
              side: THREE.DoubleSide,
            })
            : new THREE.MeshStandardMaterial({
              color: new THREE.Color(0x368f9a),
              metalness: 0.16,
              roughness: 0.58,
              side: THREE.DoubleSide,
            });
          materials.push(material);
          group.add(new THREE.Mesh(geometry, material));
        }

        if (group.children.length === 0) {
          fail("No renderable geometry was found in this 3MF file.");
          return;
        }

        group.traverse((object) => {
          const mesh = object as import("three").Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.computeBoundingBox();
          const box = mesh.geometry.boundingBox;
          if (!box) return;
          minX = Math.min(minX, box.min.x * scale);
          minY = Math.min(minY, box.min.y * scale);
          minZ = Math.min(minZ, box.min.z * scale);
          maxX = Math.max(maxX, box.max.x * scale);
          maxY = Math.max(maxY, box.max.y * scale);
          maxZ = Math.max(maxZ, box.max.z * scale);
        });

        if (!Number.isFinite(minX)) {
          fail("No renderable geometry was found in this 3MF file.");
          return;
        }

        group.scale.setScalar(scale);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        group.position.set(-centerX, -centerY, -centerZ);
        viewerScene.add(group);

        const radius = Math.max(
          Math.hypot(maxX - centerX, maxY - centerY, maxZ - centerZ),
          0.0001,
        );
        const distance = radius / Math.sin((40 * Math.PI) / 360) * 1.25;
        camera.near = Math.max(radius / 1000, 0.0001);
        camera.far = Math.max(radius * 100, distance * 4);
        camera.position.set(distance, distance * 0.72, distance);
        camera.updateProjectionMatrix();
        viewerControls.target.set(0, 0, 0);
        viewerControls.minDistance = radius * 0.08;
        viewerControls.maxDistance = distance * 12;
        viewerControls.update();
        viewerRenderer.setAnimationLoop(() => {
          viewerControls.update();
          viewerRenderer.render(viewerScene, camera);
        });
        setReady(true);
      } catch {
        fail("This 3MF file could not be previewed.");
      }
    })();

    return () => {
      active = false;
      abortController?.abort();
      resizeObserver?.disconnect();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      detachTrackpadPan?.();
      controls?.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      if (renderer) {
        renderer.setAnimationLoop(null);
        renderer.dispose();
        renderer.domElement.remove();
      }
      scene?.clear();
    };
  }, [name, src, height]);

  if (failed) {
    return (
      <div
        className="flex min-h-40 flex-wrap items-center gap-2 rounded-xl border border-[#dce5e5] bg-[#f7faf9] p-4 text-xs text-[#a34d46] dark:border-[#2a3f52] dark:bg-[#10232d] dark:text-[#e89890]"
        role="alert"
        data-testid="cad-3mf-error"
      >
        <span>{failed}</span>
        <a href={src} download={name} className="font-semibold underline underline-offset-2">
          Download 3MF
        </a>
      </div>
    );
  }

  return (
    <figure
      className="overflow-hidden rounded-xl border border-[#dce5e5] bg-[#f7faf9] dark:border-[#2a3f52] dark:bg-[#10232d]"
      data-testid="cad-3mf-viewer-figure"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-1 border-b border-[#dce5e5] px-3 py-2 text-[11px] dark:border-[#2a3f52]">
        <span className="min-w-0 truncate font-semibold text-foreground">{name}</span>
        <span className="text-muted-foreground">
          3MF model · opened in your browser · drag to rotate · two fingers to pan and zoom
        </span>
      </figcaption>
      <div className="relative">
        {!ready && (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#f7faf9] text-xs text-[#718189] dark:bg-[#10232d] dark:text-[#a8bac8]"
            role="status"
          >
            Loading 3D preview…
          </div>
        )}
        <div ref={hostRef} style={{ height }} className="w-full" data-testid="cad-3mf-viewer" />
      </div>
    </figure>
  );
}
