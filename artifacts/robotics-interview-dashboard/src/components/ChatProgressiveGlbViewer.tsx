import { useEffect, useRef, useState } from "react";
import { attachTrackpadPan } from "../lib/trackpadPan";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { getStoredAuthToken } from "../authSession";
import type { ProgressiveCadTile } from "./progressiveCadPreview";

type ChatProgressiveGlbViewerProps = {
  name: string;
  previewId: string;
  tiles: ProgressiveCadTile[];
};

const MAX_DETAIL_BYTES = 48 * 1024 * 1024;
const MAX_DETAIL_TILES = 12;

type ResidentTile = {
  root: THREE.Object3D;
  bytes: number;
};

async function loadGlb(
  url: string,
  signal: AbortSignal,
  loader: GLTFLoader,
): Promise<THREE.Object3D> {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    credentials: "include",
    headers,
    signal,
  });
  if (!response.ok) throw new Error(`Preview tile request failed (${response.status}).`);
  const bytes = await response.arrayBuffer();
  return (await loader.parseAsync(bytes, "")).scene;
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

export function ChatProgressiveGlbViewer({
  name,
  previewId,
  tiles,
}: ChatProgressiveGlbViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailCount, setDetailCount] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let active = true;
    let modelRadius = 1;
    let updateQueued = false;
    let tileUpdateTimeout: number | null = null;
    const tileRoots = new Map<string, ResidentTile>();
    const tileRequests = new Map<string, AbortController>();
    const coarseNodes = new Map<string, THREE.Object3D[]>();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.001, 1000);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setError("This browser could not start a WebGL 3D preview. Download the Parasolid file to inspect it.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", `Interactive 3D preview of ${name}`);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    // Without this the browser claims two-finger gestures for page scroll.
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x526273, 2.0));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xc7e2ff, 0.9);
    fillLight.position.set(-5, 1, -4);
    scene.add(fillLight);

    // Registered before OrbitControls so it consumes pan gestures first.
    const detachTrackpadPan = attachTrackpadPan(renderer.domElement, () => controls);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.001;
    controls.maxDistance = 1_000_000;
    const loader = new GLTFLoader();
    const apiRoot = `${import.meta.env.BASE_URL}api/storage/parasolid-preview/${encodeURIComponent(previewId)}`;
    const overviewController = new AbortController();

    const updateSize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(host);
    updateSize();

    const showCoarse = (tileId: string, visible: boolean) => {
      const nodes = coarseNodes.get(tileId);
      if (nodes) for (const node of nodes) node.visible = visible;
    };

    const evictTile = (tileId: string) => {
      const resident = tileRoots.get(tileId);
      if (!resident) return;
      scene.remove(resident.root);
      disposeTree(resident.root);
      tileRoots.delete(tileId);
      showCoarse(tileId, true);
    };

    const scheduleTileUpdate = () => {
      if (updateQueued || !active || coarseNodes.size === 0) return;
      updateQueued = true;
      tileUpdateTimeout = window.setTimeout(() => {
        tileUpdateTimeout = null;
        updateQueued = false;
        if (!active) return;
        camera.updateMatrixWorld();
        const viewProjection = new THREE.Matrix4().multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        );
        const frustum = new THREE.Frustum().setFromProjectionMatrix(viewProjection);
        const candidates = tiles
          .map((tile) => {
            const center = new THREE.Vector3(...tile.center);
            const radius = Math.max(tile.radius, modelRadius * 0.0005);
            const sphere = new THREE.Sphere(center, radius);
            const distance = camera.position.distanceTo(center);
            return { tile, center, sphere, distance, radius };
          })
          .filter(({ sphere, distance, radius }) =>
            frustum.intersectsSphere(sphere) &&
            distance < Math.max(modelRadius * 0.19, radius * 9),
          )
          .sort((a, b) =>
            a.distance / a.radius - b.distance / b.radius,
          );

        const wanted = new Set<string>();
        let wantedBytes = 0;
        for (const { tile } of candidates) {
          if (wanted.size >= MAX_DETAIL_TILES) break;
          if (wanted.size > 0 && wantedBytes + tile.bytes > MAX_DETAIL_BYTES) continue;
          wanted.add(tile.id);
          wantedBytes += tile.bytes;
        }
        if (wanted.size === 0 && candidates.length > 0) {
          wanted.add(candidates[0].tile.id);
        }

        for (const tileId of tileRoots.keys()) {
          if (!wanted.has(tileId)) evictTile(tileId);
        }
        for (const [tileId, controller] of tileRequests) {
          if (!wanted.has(tileId)) {
            controller.abort();
            tileRequests.delete(tileId);
          }
        }

        for (const { tile } of candidates) {
          if (!wanted.has(tile.id) || tileRoots.has(tile.id) || tileRequests.has(tile.id)) continue;
          const controller = new AbortController();
          tileRequests.set(tile.id, controller);
          void loadGlb(`${apiRoot}/tiles/${encodeURIComponent(tile.id)}`, controller.signal, loader)
            .then((root) => {
              if (!active || controller.signal.aborted || !wanted.has(tile.id)) {
                disposeTree(root);
                return;
              }
              root.name = `__cad_detail_${tile.id}`;
              scene.add(root);
              tileRoots.set(tile.id, { root, bytes: tile.bytes });
              showCoarse(tile.id, false);
              setDetailCount(tileRoots.size);
            })
            .catch((caught: unknown) => {
              if (active && !controller.signal.aborted) {
                setError(caught instanceof Error ? caught.message : "A detail tile could not be loaded.");
              }
            })
            .finally(() => {
              if (tileRequests.get(tile.id) === controller) tileRequests.delete(tile.id);
            });
        }
        setDetailCount(tileRoots.size);
      }, 80);
    };

    controls.addEventListener("change", scheduleTileUpdate);
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    void loadGlb(`${apiRoot}/overview`, overviewController.signal, loader)
      .then((overview) => {
        if (!active || overviewController.signal.aborted) {
          disposeTree(overview);
          return;
        }
        overview.name = "__cad_coarse_overview";
        scene.add(overview);
        overview.traverse((object) => {
          if (!object.name.startsWith("__cad_lod_")) return;
          const tileId = object.name.slice("__cad_lod_".length);
          const nodes = coarseNodes.get(tileId) ?? [];
          nodes.push(object);
          coarseNodes.set(tileId, nodes);
        });
        const bounds = new THREE.Box3().setFromObject(overview);
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) {
          throw new Error("The coarse overview has no measurable geometry.");
        }
        modelRadius = sphere.radius;
        controls.target.copy(sphere.center);
        camera.position.copy(sphere.center).add(
          new THREE.Vector3(1.8, 1.35, 2.2).normalize().multiplyScalar(sphere.radius * 3.2),
        );
        camera.near = Math.max(sphere.radius / 10_000, 0.0001);
        camera.far = Math.max(sphere.radius * 100, 10);
        camera.updateProjectionMatrix();
        controls.update();
        setViewerReady(true);
        scheduleTileUpdate();
      })
      .catch((caught: unknown) => {
        if (active && !overviewController.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "The 3D overview could not be loaded.");
        }
      });

    return () => {
      active = false;
      overviewController.abort();
      for (const controller of tileRequests.values()) controller.abort();
      tileRequests.clear();
      if (tileUpdateTimeout !== null) window.clearTimeout(tileUpdateTimeout);
      controls.removeEventListener("change", scheduleTileUpdate);
      detachTrackpadPan();
      controls.dispose();
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      disposeTree(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [name, previewId, tiles]);

  return (
    <figure
      className="my-2 overflow-hidden rounded-xl border border-[#dce9e8] bg-[#f7faf9] dark:border-[#2a3f52] dark:bg-[#10232d]"
      data-testid="chat-progressive-glb-attachment"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-1 border-b border-[#dce9e8] px-3 py-2 text-[11px] dark:border-[#2a3f52]">
        <span className="min-w-0 truncate font-semibold text-[#183a4b] dark:text-[#e5edf3]">{name}</span>
        <span className="text-[#718189] dark:text-[#a8bac8]">CAD model · drag to rotate, scroll to zoom</span>
      </figcaption>
      <div className="relative h-[320px]" ref={hostRef}>
        {!viewerReady && !error && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#f7faf9] text-xs text-[#718189] dark:bg-[#10232d] dark:text-[#a8bac8]" role="status">
            Loading coarse overview…
          </div>
        )}
        {viewerReady && (
          <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-md bg-white/85 px-2 py-1 text-[10px] text-[#526a76] dark:bg-[#0b1820]/85 dark:text-[#c2d0d8]" role="status">
            {error ?? (detailCount > 0
              ? `Full detail active for ${detailCount} nearby part${detailCount === 1 ? "" : "s"}`
              : "Zoom in to load exact geometry")}
          </div>
        )}
        {error && !viewerReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-xs text-[#a34d46] dark:text-[#e89890]" role="alert">
            <span>Couldn’t render the progressive CAD preview.</span>
            <span>{error}</span>
          </div>
        )}
      </div>
    </figure>
  );
}