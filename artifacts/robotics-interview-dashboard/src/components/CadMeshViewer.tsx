import { useEffect, useRef, useState } from "react";

import {
  MESH_PREVIEW_MAX_TRIANGLES,
  decodeHeader,
  scanObjFaces,
  validatePlyHeader,
} from "../lib/meshHeader";
import {
  attachPreviewInteraction,
  countTriangles,
  disposeObject,
  frameObject,
} from "../lib/threePreviewSession";

type CadMeshViewerProps = {
  name: string;
  src: string;
  height?: number;
};

type MeshFormat = "obj" | "ply";

/** These formats carry no unit metadata; they are millimetres by convention. */
const MILLIMETRE_LABEL = "Mesh rendered in your browser · drag to rotate · two fingers to pan";

/**
 * Renders OBJ and PLY inline.
 *
 * Both are plain triangle meshes with no CAD kernel involved: three.js ships the
 * loaders. OBJ is text and may declare any polygon, so its declared sizes are
 * scanned before parsing; PLY's declared element counts are checked from the
 * header because its binary reader trusts them and would otherwise loop for the
 * declared count regardless of how much data the file actually holds.
 */
export function CadMeshViewer({ name, src, height = 420 }: CadMeshViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const extension = name.toLowerCase().split(".").pop() ?? "";
  const format: MeshFormat = extension === "ply" ? "ply" : "obj";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let active = true;
    let abortController: AbortController | null = null;
    let scene: import("three").Scene | null = null;
    let built: import("three").Object3D | null = null;
    let renderer: import("three").WebGLRenderer | null = null;
    let detachInteraction: (() => void) | null = null;
    let THREE: typeof import("three") | null = null;

    const fail = (reason: string) => {
      if (!active) return;
      setFailed(reason);
      setReady(false);
    };

    setFailed(null);
    setReady(false);

    void (async () => {
      try {
        THREE = await import("three");
        if (!active) return;

        abortController = new AbortController();
        let bytes: Uint8Array;
        try {
          const response = await fetch(src, { signal: abortController.signal });
          if (!response.ok) throw new Error("download failed");
          bytes = new Uint8Array(await response.arrayBuffer());
        } catch {
          fail(`This ${format.toUpperCase()} file could not be downloaded.`);
          return;
        }
        if (!active) return;

        // Validate before parsing: the loaders trust the file's declared sizes.
        const headerText = decodeHeader(bytes);
        const validation =
          format === "ply" ? validatePlyHeader(headerText) : scanObjFaces(headerText);
        if (!validation.ok) {
          fail(validation.reason);
          return;
        }

        const viewerScene = new THREE.Scene();
        scene = viewerScene;
        const initialWidth = Math.max(host.clientWidth, 240);
        const camera = new THREE.PerspectiveCamera(
          40,
          initialWidth / height,
          0.001,
          1_000_000,
        );
        const viewerRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer = viewerRenderer;
        viewerRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        viewerRenderer.setSize(initialWidth, height, false);
        viewerRenderer.outputColorSpace = THREE.SRGBColorSpace;
        viewerRenderer.domElement.setAttribute("aria-label", `3D preview of ${name}`);
        viewerRenderer.domElement.setAttribute("role", "img");
        viewerRenderer.domElement.tabIndex = 0;
        viewerRenderer.domElement.style.touchAction = "pan-y";
        host.appendChild(viewerRenderer.domElement);

        viewerScene.add(new THREE.AmbientLight(0xffffff, 1.6));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(4, 6, 8);
        viewerScene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
        fillLight.position.set(-5, -3, -4);
        viewerScene.add(fillLight);

        const container = new THREE.Group();
        viewerScene.add(container);

        // Parse into the container, keeping any loader-produced materials so
        // PLY vertex colours and OBJ groups survive.
        let parsed: import("three").Object3D | import("three").BufferGeometry;
        try {
          if (format === "ply") {
            const { PLYLoader } = await import("three/addons/loaders/PLYLoader.js");
            // Copy into a standalone ArrayBuffer: the loader needs one, and a
            // view over a larger buffer would carry a byteOffset it cannot see.
            const buffer = new ArrayBuffer(bytes.byteLength);
            new Uint8Array(buffer).set(bytes);
            const geometry = new PLYLoader().parse(buffer);
            const hasColors = geometry.getAttribute("color") !== undefined;
            const material = hasColors
              ? new THREE.MeshStandardMaterial({
                vertexColors: true,
                metalness: 0.12,
                roughness: 0.6,
                side: THREE.DoubleSide,
              })
              : new THREE.MeshStandardMaterial({
                color: new THREE.Color(0x368f9a),
                metalness: 0.16,
                roughness: 0.58,
                side: THREE.DoubleSide,
              });
            geometry.computeVertexNormals();
            container.add(new THREE.Mesh(geometry, material));
            parsed = geometry;
          } else {
            const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
            // Deliberately no MTL loader: OBJ `mtllib` can name a remote file,
            // and a chat attachment must never trigger a fetch we did not ask
            // for. Faces are shaded with the house material instead.
            const group = new OBJLoader().parse(new TextDecoder().decode(bytes));
            const material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(0x368f9a),
              metalness: 0.16,
              roughness: 0.58,
              side: THREE.DoubleSide,
            });
            group.traverse((child) => {
              const mesh = child as import("three").Mesh;
              if (mesh.isMesh) {
                mesh.material = material;
                mesh.geometry.computeVertexNormals();
              }
            });
            container.add(group);
            parsed = group;
          }
        } catch {
          fail(`This ${format.toUpperCase()} file could not be parsed.`);
          return;
        }
        if (!active) return;
        built = container;
        void parsed;

        if (container.children.length === 0) {
          fail(`No renderable geometry was found in this ${format.toUpperCase()} file.`);
          return;
        }

        const triangles = countTriangles(container);
        if (triangles > MESH_PREVIEW_MAX_TRIANGLES) {
          fail(
            `This model has ${Math.round(triangles / 1000)}k triangles, too many to preview in the browser. Download the file instead.`,
          );
          return;
        }

        const radius = frameObject(THREE, container);
        if (radius <= 0) {
          fail(`No renderable geometry was found in this ${format.toUpperCase()} file.`);
          return;
        }

        const interaction = await attachPreviewInteraction({
          host,
          height,
          camera,
          renderer: viewerRenderer,
          scene: viewerScene,
          radius,
        });
        if (!active) {
          interaction.dispose();
          return;
        }
        detachInteraction = interaction.dispose;
        setReady(true);
      } catch {
        fail(`This ${format.toUpperCase()} file could not be previewed.`);
      }
    })();

    return () => {
      active = false;
      abortController?.abort();
      detachInteraction?.();
      if (built) disposeObject(built);
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      scene?.clear();
    };
  }, [name, src, height, format]);

  if (failed) {
    return (
      <div
        className="flex min-h-40 flex-wrap items-center gap-2 rounded-xl border border-[#dce5e5] bg-[#f7faf9] p-4 text-xs text-[#a34d46] dark:border-[#2a3f52] dark:bg-[#10232d] dark:text-[#e89890]"
        role="alert"
        data-testid="cad-mesh-error"
      >
        <span>{failed}</span>
        <a href={src} download={name} className="font-semibold underline underline-offset-2">
          Download {format.toUpperCase()}
        </a>
      </div>
    );
  }

  return (
    <figure
      className="overflow-hidden rounded-xl border border-[#dce5e5] bg-[#f7faf9] dark:border-[#2a3f52] dark:bg-[#10232d]"
      data-testid="cad-mesh-figure"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-1 border-b border-[#dce5e5] px-3 py-2 text-[11px] dark:border-[#2a3f52]">
        <span className="min-w-0 truncate font-semibold text-foreground">{name}</span>
        <span className="text-muted-foreground">{MILLIMETRE_LABEL}</span>
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
        <div ref={hostRef} style={{ height }} className="w-full" data-testid="cad-mesh-viewer" />
      </div>
    </figure>
  );
}