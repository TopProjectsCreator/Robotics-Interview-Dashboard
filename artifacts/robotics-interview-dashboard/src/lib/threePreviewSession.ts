import { attachTrackpadPan } from "./trackpadPan";

/**
 * Shared three.js preview helpers for the inline CAD viewers.
 *
 * Every viewer needs the same orbit controls, pan gesture, resize handling and
 * camera framing, so that lives here rather than being copied into each viewer.
 * The rendering side (what geometry to build) stays with each viewer, because
 * that part is genuinely format-specific.
 */

const DEG_TO_RAD = Math.PI / 180;

/** Matches the framing the existing viewers use, so parts read the same size. */
const FOV = 40;

export type PreviewInteraction = {
  camera: import("three").PerspectiveCamera;
  /** Frames the camera on `radius`, which must be the built content's extent. */
  frame: (radius: number) => void;
};

/**
 * Attaches orbit controls, the trackpad pan handler, resize handling and the
 * render loop to an already-created scene, and returns a teardown function.
 *
 * Kept separate from scene construction because the three import is dynamic, so
 * controls always attach after an await and must be disposed with the viewer.
 */
export async function attachPreviewInteraction(params: {
  host: HTMLElement;
  height: number;
  camera: import("three").PerspectiveCamera;
  renderer: import("three").WebGLRenderer;
  scene: import("three").Scene;
  /** Initial framing radius; later changes go through the returned `frame`. */
  radius: number;
}): Promise<PreviewInteraction & { dispose: () => void }> {
  const { host, height, camera, renderer, scene } = params;
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");

  const controls = new OrbitControls(camera, renderer.domElement);
  // A 3D canvas must own its touch gestures, or the browser spends two-finger
  // gestures on scrolling the page instead of driving the camera.
  renderer.domElement.style.touchAction = "none";

  // OrbitControls registers its own wheel listener in its constructor, so the
  // pan handler attaches first and wins the registration order.
  const detachTrackpadPan = attachTrackpadPan(renderer.domElement, () => controls);

  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  // Pan in the camera's screen plane; the default ground-plane pan is
  // disorienting for a part floating in space.
  controls.screenSpacePanning = true;

  const frame = (radius: number) => {
    const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0.0001;
    const distance = safeRadius / Math.sin((FOV * DEG_TO_RAD) / 2) * 1.25;
    camera.near = Math.max(safeRadius / 1000, 0.0001);
    camera.far = Math.max(safeRadius * 100, distance * 4);
    camera.position.set(distance, distance * 0.72, distance);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.minDistance = safeRadius * 0.08;
    controls.maxDistance = distance * 12;
    controls.update();
  };

  const resize = () => {
    const width = Math.max(host.clientWidth, 320);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
  }
  window.addEventListener("resize", resize);

  frame(params.radius);

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    camera,
    frame,
    dispose: () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      detachTrackpadPan();
      controls.dispose();
      renderer.setAnimationLoop(null);
    },
  };
}

/** Frames an object by its world-space bounds, returning the bounding radius. */
export function frameObject(THREE: typeof import("three"), object: import("three").Object3D): number {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return 0;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  return Number.isFinite(sphere.radius) && sphere.radius > 0 ? sphere.radius : 0;
}

/**
 * Counts triangles under an object, used to enforce the preview budget after a
 * loader has parsed the file.
 */
export function countTriangles(object: import("three").Object3D): number {
  let triangles = 0;
  object.traverse((child) => {
    const mesh = child as import("three").Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    if (!geometry) return;
    const index = geometry.getIndex();
    triangles += index ? index.count / 3 : geometry.getAttribute("position")?.count / 3 || 0;
  });
  return triangles;
}

/** Releases every geometry and material under an object. */
export function disposeObject(object: import("three").Object3D): void {
  object.traverse((child) => {
    const mesh = child as import("three").Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose();
  });
}