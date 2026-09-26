import { useEffect, useRef, useState } from "react";

type ChatStlViewerProps = {
  name: string;
  src: string;
};

export function ChatStlViewer({ name, src }: ChatStlViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let active = true;
    let request: XMLHttpRequest | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeHandler: (() => void) | null = null;
    let renderer: import("three").WebGLRenderer | null = null;
    let controls: import("three/addons/controls/OrbitControls.js").OrbitControls | null = null;
    let geometry: import("three").BufferGeometry | null = null;
    let material: import("three").Material | null = null;
    const fail = () => {
      if (active) {
        setFailed(true);
        setViewerReady(false);
      }
    };

    setFailed(false);
    setViewerReady(false);

    void (async () => {
      try {
        const [THREE, { STLLoader }, { OrbitControls }] = await Promise.all([
          import("three"),
          import("three/addons/loaders/STLLoader.js"),
          import("three/addons/controls/OrbitControls.js"),
        ]);
        if (!active) return;

        const width = Math.max(host.clientWidth, 320);
        const height = 320;
        const scene = new THREE.Scene();
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

        scene.add(new THREE.AmbientLight(0xffffff, 1.7));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
        keyLight.position.set(4, 6, 8);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.7);
        fillLight.position.set(-5, -3, -4);
        scene.add(fillLight);

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

        const loader = new STLLoader();
        request = loader.load(
          src,
          loadedGeometry => {
            if (!active) {
              loadedGeometry.dispose();
              return;
            }
            try {
              const positions = loadedGeometry.getAttribute("position");
              if (!positions || positions.count < 3) {
                loadedGeometry.dispose();
                fail();
                return;
              }
              geometry = loadedGeometry;
              geometry.computeVertexNormals();
              geometry.center();
              geometry.computeBoundingSphere();
              const radius = geometry.boundingSphere?.radius ?? 0;
              if (!Number.isFinite(radius) || radius <= 0) {
                fail();
                return;
              }

              material = new THREE.MeshStandardMaterial({
                color: 0x368f9a,
                metalness: 0.16,
                roughness: 0.58,
              });
              scene.add(new THREE.Mesh(geometry, material));

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
                viewerRenderer.render(scene, camera);
              });
              setViewerReady(true);
            } catch {
              fail();
            }
          },
          undefined,
          fail,
        );
      } catch {
        fail();
      }
    })();

    return () => {
      active = false;
      request?.abort();
      resizeObserver?.disconnect();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      controls?.dispose();
      geometry?.dispose();
      material?.dispose();
      if (renderer) {
        renderer.setAnimationLoop(null);
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, [name, src]);

  return (
    <figure className="my-2 overflow-hidden rounded-xl border border-[#dce9e8] bg-[#f7faf9] dark:border-[#2a3f52] dark:bg-[#10232d]" data-testid="chat-stl-attachment">
      <figcaption className="flex flex-wrap items-center justify-between gap-1 border-b border-[#dce9e8] px-3 py-2 text-[11px] dark:border-[#2a3f52]">
        <span className="min-w-0 truncate font-semibold text-[#183a4b] dark:text-[#e5edf3]">{name}</span>
        <span className="text-[#718189] dark:text-[#a8bac8]">STL model · drag to rotate, scroll to zoom</span>
      </figcaption>
      {failed ? (
        <div className="flex min-h-24 flex-wrap items-center gap-2 p-4 text-xs text-[#a34d46] dark:text-[#e89890]" role="status">
          <span>Couldn’t render this STL model.</span>
          <a href={src} download={name} className="font-semibold underline underline-offset-2">Download STL</a>
        </div>
      ) : (
        <div className="relative">
          {!viewerReady && (
            <div className="pointer-events-none absolute inset-0 z-10 flex h-[320px] items-center justify-center bg-[#f7faf9] text-xs text-[#718189] dark:bg-[#10232d] dark:text-[#a8bac8]" role="status">
              Loading 3D preview…
            </div>
          )}
          <div ref={hostRef} className="h-[320px] w-full" />
        </div>
      )}
    </figure>
  );
}