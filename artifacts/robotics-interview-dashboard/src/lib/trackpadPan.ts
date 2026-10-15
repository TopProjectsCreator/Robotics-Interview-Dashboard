/**
 * Trackpad panning for the inline 3D viewers.
 *
 * three.js OrbitControls already maps two *touchscreen* fingers to
 * dolly-and-pan, but a trackpad does not send touch events: two-finger
 * scrolling arrives as a `wheel` event whose horizontal component OrbitControls
 * discards, because its wheel handler only reads `deltaY` and zooms. So on a
 * trackpad, two-finger pan did not exist — only two-finger zoom.
 *
 * This module adds it: a wheel event dominated by horizontal motion pans the
 * camera in the screen plane, while a plain scroll or a pinch keeps zooming.
 */

export type Vec3Like = { x: number; y: number; z: number };

export type PerspectiveCameraLike = {
  position: Vec3Like;
  fov: number;
  /** Column-major 4x4; the first three columns are the camera's right, up, forward. */
  matrixWorld: { elements: ArrayLike<number> };
};

export type TrackpadWheelAction = "pan" | "delegate";

/**
 * Decides what a wheel gesture means. Kept separate from the DOM work so the
 * rule can be tested directly.
 *
 * - A pinch on a trackpad arrives as `ctrlKey` + `wheel` and must keep zooming.
 * - Two-finger panning is dominated by `deltaX`; a scroll or a mouse wheel has
 *   no horizontal component.
 */
export function trackpadWheelAction(input: {
  ctrlKey: boolean;
  deltaX: number;
  deltaY: number;
}): TrackpadWheelAction {
  if (input.ctrlKey) return "delegate";
  const horizontal = Math.abs(input.deltaX);
  const vertical = Math.abs(input.deltaY);
  if (horizontal > 0 && horizontal > vertical) return "pan";
  return "delegate";
}

/**
 * Moves the camera and its orbit target together, in the camera's own screen
 * plane. This mirrors OrbitControls' own panning maths so a trackpad pan feels
 * identical to a right-drag pan rather than inventing a second convention.
 */
export function panScreenSpace(params: {
  camera: PerspectiveCameraLike;
  target: Vec3Like;
  deltaX: number;
  deltaY: number;
  viewportHeight: number;
}): void {
  const { camera, target, deltaX, deltaY, viewportHeight } = params;
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return;

  const elements = camera.matrixWorld.elements;
  // Column-major: column 0 is right, column 1 is up.
  const rightX = elements[0];
  const rightY = elements[1];
  const rightZ = elements[2];
  const upX = elements[4];
  const upY = elements[5];
  const upZ = elements[6];
  if (!Number.isFinite(rightX) || !Number.isFinite(upX)) return;

  // Half the field of view, centre to top of screen, as OrbitControls does.
  const offsetX = camera.position.x - target.x;
  const offsetY = camera.position.y - target.y;
  const offsetZ = camera.position.z - target.z;
  const distance =
    Math.sqrt(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ) *
    Math.tan((camera.fov / 2) * (Math.PI / 180));
  const worldPerPixel = (2 * distance) / viewportHeight;

  // Panning right drags the model right, which moves the camera left.
  const moveRight = -deltaX * worldPerPixel;
  const moveUp = deltaY * worldPerPixel;
  const shiftX = rightX * moveRight + upX * moveUp;
  const shiftY = rightY * moveRight + upY * moveUp;
  const shiftZ = rightZ * moveRight + upZ * moveUp;
  if (![shiftX, shiftY, shiftZ].every(Number.isFinite)) return;

  camera.position.x += shiftX;
  camera.position.y += shiftY;
  camera.position.z += shiftZ;
  target.x += shiftX;
  target.y += shiftY;
  target.z += shiftZ;
}

type ControlsLike = { target: Vec3Like; update: () => void };

/**
 * Installs the trackpad pan handler on a viewer's canvas.
 *
 * `getControls` is a callback rather than the controls object because the
 * listener has to be registered *before* OrbitControls is constructed:
 * listeners on the same element fire in registration order, and
 * `stopImmediatePropagation` is what stops OrbitControls from also zooming a
 * gesture this handler already consumed. The callback returns null until the
 * controls exist.
 *
 * Returns a disposer for teardown.
 */
export function attachTrackpadPan(
  element: HTMLElement,
  getControls: () => ControlsLike | null,
): () => void {
  const onWheel = (event: WheelEvent) => {
    if (
      trackpadWheelAction({
        ctrlKey: event.ctrlKey,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
      }) !== "pan"
    ) {
      return;
    }
    const controls = getControls();
    if (!controls) return;
    const camera = controlsOrbitCamera(controls);
    if (!camera) return;
    event.preventDefault();
    // OrbitControls registered its own wheel listener on this element; without
    // this the same gesture would zoom as well as pan.
    event.stopImmediatePropagation();
    panScreenSpace({
      camera,
      target: controls.target,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      viewportHeight: element.clientHeight,
    });
    controls.update();
  };
  element.addEventListener("wheel", onWheel, { passive: false });
  return () => element.removeEventListener("wheel", onWheel);
}

/**
 * OrbitControls keeps its camera in a private field, so read it back off the
 * controls object rather than requiring callers to pass it twice.
 */
function controlsOrbitCamera(controls: ControlsLike): PerspectiveCameraLike | null {
  const candidate = (controls as { object?: unknown }).object;
  if (!candidate || typeof candidate !== "object") return null;
  const camera = candidate as Partial<PerspectiveCameraLike>;
  if (
    typeof camera.fov !== "number" ||
    !camera.position ||
    !camera.matrixWorld?.elements
  ) {
    return null;
  }
  return camera as PerspectiveCameraLike;
}
