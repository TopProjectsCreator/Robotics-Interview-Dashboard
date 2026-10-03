import { useEffect, useRef, useState } from "react";

// Emitted as a hashed asset so the WASM loader never guesses a path.
import occtWasmUrl from "occt-import-js/dist/occt-import-js.wasm?url";

type ChatStepViewerProps = {
  name: string;
  src: string;
};

type OcctMesh = {
  name?: string;
  color?: number[];
  attributes: { position: { array: number[] }; normal?: { array: number[] } };
  index: { array: number[] };
};

type OcctResult = {
  success: boolean;
  meshes: OcctMesh[];
};

const MAX_TRIANGLES = 1_500_000;

/**
 * Renders STEP / IGES / BREP inline. Conversion runs entirely in the browser
 * via OpenCascade compiled to WebAssembly (occt-import-js), so no CAD tooling
 * is needed on the server and huge assemblies never touch the API process.
 */
export function ChatStepViewer({ name, src }: ChatStepViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [failedReason, setFailedReason] = useState("");
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let active = true;
    let abortController: AbortController | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeHandler: (() => void) | null = null;
    let renderer: import("three").WebGLRenderer | null = null;
    let controls: import("three/addons/controls/OrbitControls.js").OrbitControls | null = null;
    let scene: import("three").Scene | null = null;
    const geometries: import("three").BufferGeometry[] = [];
    const materials: import("three").Material[] = [];
    const fail = (reason: string) => {
      if (active) {
        setFailed(true);
        setFailedReason(reason);
        setViewerReady(false);
      }
    };

    setFailed(false);
    setFailedReason("");
    setViewerReady(false);

    void (async () => {
      try {
        const [THREE, { OrbitControls }, occtModule] = await Promise.all([
          import("three"),
          import("three/addons/controls/OrbitControls.js"),
          import("occt-import-js"),
        ]);
        const occtFactory = (occtModule.default ?? occtModule) as unknown as (options?: {
          locateFile?: (file: string, prefix: string) => string;
        }) => Promise<{
          ReadStepFile: (bytes: Uint8Array, params: null) => OcctResult;
          ReadIgesFile: (bytes: Uint8Array, params: null) => OcctResult;
          ReadBrepFile: (bytes: Uint8Array, params: null) => OcctResult;
        }>;
        const occt = await occtFactory({ locateFile: () => occtWasmUrl });
        if (!active) return;

        const width = Math.max(host.clientWidth, 320);
        const height = 340;
        const viewerScene = new THREE.Scene();
        scene = viewerScene;
        const camera = new THREE.PerspectiveCamera(40, width / height, 0.001, 1_000_000);
        const viewerRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer = viewerRenderer;
        viewerRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        viewerRenderer.setSize(width, height, false);
        viewerRenderer.outputColorSpace = THREE.SRGBColorSpace;
        viewerRenderer.domElement.setAttribute("aria-label", `3D preview of ${name}`);
        viewerRenderer.domElement.setAttribute("role", "img");
        viewerRenderer.domElement.tabIndex = 0;
        host.appendChild(viewerRenderer.domElement);

        viewerScene.add(new THREE.AmbientLight(0xffffff, 1.6));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(4, 6, 8);
        viewerScene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
        fillLight.position.set(-5, -3, -4);
        viewerScene.add(fillLight);

        const viewerControls = new OrbitControls(camera, viewerRenderer.domElement);
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

        abortController = new AbortController();
        const extension = name.split(".").pop()?.toLowerCase() ?? "";
        let bytes: Uint8Array;
        try {
          const response = await fetch(src, { signal: abortController.signal });
          if (!response.ok) throw new Error("download failed");
          bytes = new Uint8Array(await response.arrayBuffer());
        } catch {
          if (active) fail("This file could not be downloaded.");
          return;
        }
        if (!active) return;

        let result: OcctResult;
        try {
          const reader = extension === "iges" || extension === "igs"
            ? occt.ReadIgesFile
            : extension === "brep" || extension === "brp"
              ? occt.ReadBrepFile
              : occt.ReadStepFile;
          result = reader(bytes, null);
        } catch {
          if (active) fail("This CAD file could not be parsed.");
          return;
        }
        if (!active) return;
        if (!result?.success || !result.meshes?.length) {
          fail("No renderable geometry was found in this file.");
          return;
        }

        const triangleCount = result.meshes.reduce(
          (total, mesh) => total + Math.floor((mesh.index?.array?.length ?? 0) / 3),
          0,
        );
        if (triangleCount === 0) {
          fail("No renderable geometry was found in this file.");
          return;
        }
        if (triangleCount > MAX_TRIANGLES) {
          fail(`This model has ${Math.round(triangleCount / 1000)}k triangles, too many to preview in the browser.`);
          return;
        }

        let overallRadius = 0;
        const meshObjects: import("three").Mesh[] = [];
        for (const mesh of result.meshes) {
          const positions = mesh.attributes?.position?.array;
          const indices = mesh.index?.array;
          if (!positions?.length || !indices?.length) continue;
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
          if (mesh.attributes?.normal?.array?.length) {
            geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3));
          } else {
            geometry.computeVertexNormals();
          }
          geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
          geometry.computeBoundingSphere();
          const radius = geometry.boundingSphere?.radius ?? 0;
          if (!Number.isFinite(radius) || radius <= 0) {
            geometry.dispose();
            continue;
          }
          geometries.push(geometry);
          const hasColor = Array.isArray(mesh.color) && mesh.color.length >= 3;
          const material = new THREE.MeshStandardMaterial({
            color: hasColor
              ? new THREE.Color(
                (mesh.color?.[0] ?? 0) / 255,
                (mesh.color?.[1] ?? 0) / 255,
                (mesh.color?.[2] ?? 0) / 255,
              )
              : new THREE.Color(0x368f9a),
            metalness: hasColor ? 0.3 : 0.16,
            roughness: hasColor ? 0.42 : 0.58,
            side: THREE.DoubleSide,
          });
          materials.push(material);
          meshObjects.push(new THREE.Mesh(geometry, material));
        }

        if (!meshObjects.length) {
          fail("No renderable geometry was found in this file.");
          return;
        }

        // Group under one centred origin so orbit/zoom framing is predictable.
        const { group, radius } = groupAndCentre(THREE, meshObjects);
        viewerScene.add(group);
        overallRadius = radius;

        const distance = overallRadius / Math.sin((40 * Math.PI) / 360) * 1.25;
        camera.near = Math.max(overallRadius / 1000, 0.0001);
        camera.far = Math.max(overallRadius * 100, distance * 4);
        camera.position.set(distance, distance * 0.72, distance);
        camera.updateProjectionMatrix();
        viewerControls.target.set(0, 0, 0);
        viewerControls.minDistance = overallRadius * 0.08;
        viewerControls.maxDistance = distance * 12;
        viewerControls.update();
        viewerRenderer.setAnimationLoop(() => {
          viewerControls.update();
          viewerRenderer.render(viewerScene, camera);
        });
        setViewerReady(true);
      } catch {
        fail("This CAD file could not be previewed.");
      }
    })();

    return () => {
      active = false;
      abortController?.abort();
      resizeObserver?.disconnect();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
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
  }, [name, src]);

  return (
    <figure className="my-2 overflow-hidden rounded-xl border border-[#dce9e8] bg-[#f7faf9] dark:border-[#2a3f52] dark:bg-[#10232d]" data-testid="chat-step-attachment">
      <figcaption className="flex flex-wrap items-center justify-between gap-1 border-b border-[#dce9e8] px-3 py-2 text-[11px] dark:border-[#2a3f52]">
        <span className="min-w-0 truncate font-semibold text-[#183a4b] dark:text-[#e5edf3]">{name}</span>
        <span className="text-[#718189] dark:text-[#a8bac8]">STEP model · converted in your browser · drag to rotate</span>
      </figcaption>
      {failed ? (
        <div className="flex min-h-24 flex-wrap items-center gap-2 p-4 text-xs text-[#a34d46] dark:text-[#e89890]" role="status">
          <span>{failedReason || "Couldn’t render this CAD file."}</span>
          <a href={src} download={name} className="font-semibold underline underline-offset-2">Download file</a>
        </div>
      ) : (
        <div className="relative">
          {!viewerReady && (
            <div className="pointer-events-none absolute inset-0 z-10 flex h-[340px] items-center justify-center bg-[#f7faf9] text-xs text-[#718189] dark:bg-[#10232d] dark:text-[#a8bac8]" role="status">
              Loading 3D preview…
            </div>
          )}
          <div ref={hostRef} className="h-[340px] w-full" />
        </div>
      )}
    </figure>
  );
}

function groupAndCentre(
  THREE: typeof import("three"),
  meshes: import("three").Mesh[],
): { group: import("three").Group; radius: number } {
  const group = new THREE.Group();
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box) continue;
    minX = Math.min(minX, box.min.x);
    minY = Math.min(minY, box.min.y);
    minZ = Math.min(minZ, box.min.z);
    maxX = Math.max(maxX, box.max.x);
    maxY = Math.max(maxY, box.max.y);
    maxZ = Math.max(maxZ, box.max.z);
  }
  if (!Number.isFinite(minX)) throw new Error("empty model");
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  for (const mesh of meshes) {
    mesh.geometry.translate(-centerX, -centerY, -centerZ);
    group.add(mesh);
  }
  return {
    group,
    radius: Math.max(Math.hypot(maxX - centerX, maxY - centerY, maxZ - centerZ), 0.0001),
  };
}
