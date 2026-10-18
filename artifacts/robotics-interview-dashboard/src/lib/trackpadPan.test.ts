import { describe, expect, it } from "vitest";

import { panScreenSpace, trackpadWheelAction } from "./trackpadPan";

/**
 * A camera looking down -Z from +Z, which is the default orientation the
 * viewers set up, so right = +X and up = +Y. Column-major, as three.js stores
 * matrices.
 */
function camera() {
  const position = { x: 0, y: 0, z: 100 };
  return {
    position,
    fov: 40,
    matrixWorld: {
      elements: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
    },
  };
}

describe("trackpadWheelAction", () => {
  it("treats a horizontal two-finger gesture as a pan", () => {
    expect(trackpadWheelAction({ ctrlKey: false, deltaX: 24, deltaY: 0 })).toBe("pan");
    expect(trackpadWheelAction({ ctrlKey: false, deltaX: 30, deltaY: -8 })).toBe("pan");
  });

  it("leaves a vertical scroll to the zoom handler", () => {
    expect(trackpadWheelAction({ ctrlKey: false, deltaX: 0, deltaY: 120 })).toBe("delegate");
    expect(trackpadWheelAction({ ctrlKey: false, deltaX: -3, deltaY: 40 })).toBe("delegate");
  });

  it("leaves a pinch alone, because a pinch must keep zooming", () => {
    // Trackpad pinch arrives as ctrl+wheel; hijacking it would break zooming.
    expect(trackpadWheelAction({ ctrlKey: true, deltaX: 12, deltaY: -40 })).toBe("delegate");
    expect(trackpadWheelAction({ ctrlKey: true, deltaX: 0, deltaY: -4 })).toBe("delegate");
  });

  it("ignores a gesture with no movement at all", () => {
    expect(trackpadWheelAction({ ctrlKey: false, deltaX: 0, deltaY: 0 })).toBe("delegate");
  });
});

describe("panScreenSpace", () => {
  it("moves the camera and the orbit target together so the model appears dragged", () => {
    const view = camera();
    const target = { x: 0, y: 0, z: 0 };

    panScreenSpace({
      camera: view,
      target,
      deltaX: 50,
      deltaY: 0,
      viewportHeight: 400,
    });

    // Dragging right moves the model right, which moves the camera left.
    expect(view.position.x).toBeLessThan(0);
    expect(view.position.z).toBeCloseTo(100, 6);
    expect(target.x).toBe(view.position.x);
    expect(target.y).toBeCloseTo(0, 6);
  });

  it("pans vertically along the camera's up axis", () => {
    const view = camera();
    const target = { x: 0, y: 0, z: 0 };

    panScreenSpace({ camera: view, target, deltaX: 0, deltaY: 40, viewportHeight: 400 });

    expect(view.position.y).toBeGreaterThan(0);
    expect(view.position.x).toBeCloseTo(0, 6);
    expect(target.y).toBe(view.position.y);
  });

  it("keeps the camera's distance from the target, so panning never zooms", () => {
    const view = camera();
    const target = { x: 5, y: -3, z: 0 };
    const before = Math.hypot(
      view.position.x - target.x,
      view.position.y - target.y,
      view.position.z - target.z,
    );

    panScreenSpace({ camera: view, target, deltaX: 90, deltaY: -40, viewportHeight: 320 });

    const after = Math.hypot(
      view.position.x - target.x,
      view.position.y - target.y,
      view.position.z - target.z,
    );
    expect(after).toBeCloseTo(before, 6);
  });

  it("scales pan distance with the field of view and viewport height", () => {
    // A wide viewport shows more of the model per pixel, so the same gesture
    // must move the camera further to look equivalent.
    const wide = camera();
    panScreenSpace({ camera: wide, target: { x: 0, y: 0, z: 0 }, deltaX: 50, deltaY: 0, viewportHeight: 100 });
    const tall = camera();
    panScreenSpace({ camera: tall, target: { x: 0, y: 0, z: 0 }, deltaX: 50, deltaY: 0, viewportHeight: 1000 });
    expect(Math.abs(wide.position.x)).toBeGreaterThan(Math.abs(tall.position.x));
  });

  it("pans along the camera's own right/up axes when it is rotated", () => {
    const view = camera();
    // Yaw 90 degrees: the camera's right axis now points along -Z.
    view.matrixWorld = {
      elements: [
        0, 0, -1, 0,
        0, 1, 0, 0,
        1, 0, 0, 0,
        0, 0, 0, 1,
      ],
    };
    const target = { x: 0, y: 0, z: 0 };

    panScreenSpace({ camera: view, target, deltaX: 50, deltaY: 0, viewportHeight: 400 });

    expect(view.position.x).toBeCloseTo(0, 6);
    expect(view.position.z).not.toBeCloseTo(100, 3);
  });

  it("does nothing for a degenerate viewport or non-finite input", () => {
    const view = camera();
    const target = { x: 0, y: 0, z: 0 };
    panScreenSpace({ camera: view, target, deltaX: 50, deltaY: 0, viewportHeight: 0 });
    panScreenSpace({ camera: view, target, deltaX: Number.NaN, deltaY: 0, viewportHeight: 400 });
    panScreenSpace({
      camera: view,
      target,
      deltaX: Number.POSITIVE_INFINITY,
      deltaY: 0,
      viewportHeight: 400,
    });
    expect(view.position).toEqual({ x: 0, y: 0, z: 100 });
    expect(target).toEqual({ x: 0, y: 0, z: 0 });
  });
});
