import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getGetFtcGlobeDataQueryKey, useGetFtcGlobeData } from "@workspace/api-client-react";
import type { FtcGlobePoint } from "@workspace/api-client-react";
import { ArrowUpRight, CalendarDays, MapPin, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

type GlobePoint = FtcGlobePoint;
const DEFAULT_GLOBE_ZOOM = 1.2;
const GLOBE_MARKER_REFERENCE_ZOOM = 1.8;
const MIN_GLOBE_ZOOM = 0.75;
export const MAX_GLOBE_ZOOM = 200;
const GLOBE_ZOOM_STEP = 0.2;
export const GLOBE_DETAIL_ZOOM_THRESHOLD = 2.4;
export const GLOBE_CARTOGRAPHY_ZOOM_THRESHOLD = 4;
const GLOBE_DETAIL_TEXTURE = "ftc-globe-boundaries-10m.svg";
const GLOBE_CARTOGRAPHY_TEXTURE = "ftc-globe-hydrography-cities.svg";
const GLOBE_MAP_TILE_MIN_ZOOM = 3;
const GLOBE_MAP_TILE_MAX_ZOOM = 11;
const GLOBE_MAP_TILE_SEGMENTS = 8;

export function clampGlobeZoom(value: number) {
  return Math.max(MIN_GLOBE_ZOOM, Math.min(MAX_GLOBE_ZOOM, value));
}

export function wrapGlobeRotation(value: number) {
  return THREE.MathUtils.euclideanModulo(value + Math.PI, Math.PI * 2) - Math.PI;
}

export function rotateGlobeFromDrag(root: THREE.Group, deltaX: number, deltaY: number, rotationScale = 1) {
  root.rotation.y = wrapGlobeRotation(root.rotation.y + deltaX * 0.006 * rotationScale);
  root.rotation.x = wrapGlobeRotation(root.rotation.x + deltaY * 0.004 * rotationScale);
}

export function getGlobeMarkerZoomScale(zoom: number) {
  return GLOBE_MARKER_REFERENCE_ZOOM / clampGlobeZoom(zoom);
}

export function getGlobeRotationScale(zoom: number) {
  return DEFAULT_GLOBE_ZOOM / clampGlobeZoom(zoom);
}

export function stepGlobeZoom(value: number, direction: -1 | 1) {
  const step = value < 2.2 ? GLOBE_ZOOM_STEP : Math.max(GLOBE_ZOOM_STEP, value * 0.15);
  return clampGlobeZoom(Number((value + direction * step).toFixed(2)));
}

export function shouldUseGlobeDetail(zoom: number) {
  return zoom >= GLOBE_DETAIL_ZOOM_THRESHOLD;
}

export function shouldUseGlobeCartography(zoom: number) {
  return zoom >= GLOBE_CARTOGRAPHY_ZOOM_THRESHOLD;
}

export function globeMapTileZoom(zoom: number) {
  return THREE.MathUtils.clamp(
    Math.ceil(Math.log2(clampGlobeZoom(zoom)) + 3),
    GLOBE_MAP_TILE_MIN_ZOOM,
    GLOBE_MAP_TILE_MAX_ZOOM,
  );
}

function longitudeToTileX(longitude: number, zoom: number) {
  const tileCount = 2 ** zoom;
  return Math.floor(((longitude + 180) / 360) * tileCount);
}

function latitudeToTileY(latitude: number, zoom: number) {
  const tileCount = 2 ** zoom;
  const radians = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(latitude, -85.05112878, 85.05112878));
  return Math.floor(((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * tileCount);
}

export function getGlobeMapTiles(longitude: number, latitude: number, zoom: number, aspect = 1) {
  const tileZoom = globeMapTileZoom(zoom);
  const tileCount = 2 ** tileZoom;
  const safeLatitude = THREE.MathUtils.clamp(latitude, -84, 84);
  const halfHeightDegrees = THREE.MathUtils.radToDeg(
    Math.atan((3.5 * Math.tan(THREE.MathUtils.degToRad(34 / 2))) / clampGlobeZoom(zoom)),
  );
  const halfLongitudeDegrees = (halfHeightDegrees * Math.max(1, aspect)) /
    Math.max(0.15, Math.cos(THREE.MathUtils.degToRad(safeLatitude)));
  const centerX = longitudeToTileX(longitude, tileZoom);
  const centerY = latitudeToTileY(safeLatitude, tileZoom);
  const radiusX = Math.min(4, Math.max(1, Math.ceil(halfLongitudeDegrees / (360 / tileCount)) + 1));
  const latitudeTop = Math.min(85.05112878, safeLatitude + halfHeightDegrees);
  const latitudeBottom = Math.max(-85.05112878, safeLatitude - halfHeightDegrees);
  const topY = latitudeToTileY(latitudeTop, tileZoom);
  const bottomY = latitudeToTileY(latitudeBottom, tileZoom);
  const radiusY = Math.min(4, Math.max(1, Math.ceil(Math.max(centerY - topY, bottomY - centerY)) + 1));
  const tiles: Array<{ x: number; y: number; z: number; key: string }> = [];

  for (let dy = -radiusY; dy <= radiusY; dy += 1) {
    const y = centerY + dy;
    if (y < 0 || y >= tileCount) continue;
    for (let dx = -radiusX; dx <= radiusX; dx += 1) {
      const x = ((centerX + dx) % tileCount + tileCount) % tileCount;
      tiles.push({ x, y, z: tileZoom, key: `${tileZoom}/${x}/${y}` });
    }
  }

  return tiles.sort((left, right) => {
    const leftX = Math.min((left.x - centerX + tileCount) % tileCount, (centerX - left.x + tileCount) % tileCount);
    const rightX = Math.min((right.x - centerX + tileCount) % tileCount, (centerX - right.x + tileCount) % tileCount);
    return leftX ** 2 + (left.y - centerY) ** 2 - rightX ** 2 - (right.y - centerY) ** 2;
  });
}

export function globeMapTileUrl(tile: { x: number; y: number; z: number }) {
  return `https://tile.openstreetmap.de/${tile.z}/${tile.x}/${tile.y}.png`;
}

export function pointPosition(
  point: Pick<GlobePoint, "latitude" | "longitude">,
  radius: number,
  latitudeOffset = 0,
  longitudeOffset = 0,
) {
  const lat = THREE.MathUtils.degToRad(point.latitude + latitudeOffset);
  const lon = THREE.MathUtils.degToRad(point.longitude + longitudeOffset);
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  );
}

export function findGlobePointAtScreen({
  points,
  markerOffsets,
  root,
  camera,
  clientX,
  clientY,
  rect,
  hitRadius = 24,
}: {
  points: GlobePoint[];
  markerOffsets: Map<string, { latitude: number; longitude: number }>;
  root: THREE.Group;
  camera: THREE.PerspectiveCamera;
  clientX: number;
  clientY: number;
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">;
  hitRadius?: number;
}) {
  root.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
  const cameraDirection = new THREE.Vector3();
  let nearestPoint: GlobePoint | null = null;
  let nearestDistanceSquared = hitRadius * hitRadius;
  const projected = new THREE.Vector3();

  for (const point of points) {
    const offset = markerOffsets.get(point.id);
    const latitude = THREE.MathUtils.degToRad(point.latitude + (offset?.latitude ?? 0));
    const longitude = THREE.MathUtils.degToRad(point.longitude + (offset?.longitude ?? 0));
    projected.set(
      1.012 * Math.cos(latitude) * Math.sin(longitude),
      1.012 * Math.sin(latitude),
      1.012 * Math.cos(latitude) * Math.cos(longitude),
    );
    root.localToWorld(projected);
    cameraDirection.subVectors(cameraPosition, projected);
    if (projected.dot(cameraDirection) <= 0) continue;
    projected.project(camera);
    if (projected.z < -1 || projected.z > 1) continue;

    const screenX = rect.left + ((projected.x + 1) * rect.width) / 2;
    const screenY = rect.top + ((1 - projected.y) * rect.height) / 2;
    const distanceSquared = (screenX - clientX) ** 2 + (screenY - clientY) ** 2;
    if (distanceSquared <= nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
      nearestPoint = point;
    }
  }

  return nearestPoint;
}

function makeEarthTexture(source = "ftc-globe-world.svg", onError?: () => void) {
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}${source}`, undefined, undefined, onError);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  // Sphere U and east-positive longitude now advance in the same direction.
  texture.repeat.x = 1;
  texture.offset.x = 0.25;
  return texture;
}

function createGlobeMapTileGeometry(tile: { x: number; y: number; z: number }) {
  const tileCount = 2 ** tile.z;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= GLOBE_MAP_TILE_SEGMENTS; row += 1) {
    const mercatorY = (tile.y + row / GLOBE_MAP_TILE_SEGMENTS) / tileCount;
    const latitude = THREE.MathUtils.radToDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * mercatorY))));
    for (let column = 0; column <= GLOBE_MAP_TILE_SEGMENTS; column += 1) {
      const longitude = ((tile.x + column / GLOBE_MAP_TILE_SEGMENTS) / tileCount) * 360 - 180;
      const position = pointPosition({ latitude, longitude }, 1.006);
      positions.push(position.x, position.y, position.z);
      uvs.push(column / GLOBE_MAP_TILE_SEGMENTS, row / GLOBE_MAP_TILE_SEGMENTS);
    }
  }

  const rowLength = GLOBE_MAP_TILE_SEGMENTS + 1;
  for (let row = 0; row < GLOBE_MAP_TILE_SEGMENTS; row += 1) {
    for (let column = 0; column < GLOBE_MAP_TILE_SEGMENTS; column += 1) {
      const northwest = row * rowLength + column;
      const northeast = northwest + 1;
      const southwest = northwest + rowLength;
      const southeast = southwest + 1;
      indices.push(northwest, northeast, southeast, northwest, southeast, southwest);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function getMarkerOffsets(points: GlobePoint[]) {
  const groups = new Map<string, GlobePoint[]>();
  for (const point of points) {
    const key = `${point.latitude}|${point.longitude}`;
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  }

  const offsets = new Map<string, { latitude: number; longitude: number }>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.forEach((point, index) => {
      const angle = index * 2.399963229728653;
      const spread = Math.min(1.2, 0.8 + index * 0.02);
      const latitude = spread * Math.sin(angle);
      const longitude = (spread * Math.cos(angle)) / Math.max(0.25, Math.cos(THREE.MathUtils.degToRad(point.latitude)));
      offsets.set(point.id, { latitude, longitude });
    });
  }
  return offsets;
}

type GlobePointerEvent = Pick<PointerEvent, "pointerId" | "pointerType" | "clientX" | "clientY">;

export function createGlobePointerGestureHandlers({
  onRotate,
  onZoom,
  onSelect,
}: {
  onRotate: (deltaX: number, deltaY: number) => void;
  onZoom: (scale: number) => void;
  onSelect: (clientX: number, clientY: number) => void;
}) {
  const touchPointers = new Map<number, { x: number; y: number }>();
  let dragging = false;
  let activeDragPointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let previousX = 0;
  let previousY = 0;
  let moved = false;
  let touchGestureActive = false;
  let pinchActive = false;
  let previousPinchDistance: number | null = null;

  const distanceBetweenTouches = () => {
    const [first, second] = [...touchPointers.values()];
    return Math.hypot(second.x - first.x, second.y - first.y);
  };

  const beginDrag = (event: GlobePointerEvent) => {
    dragging = true;
    activeDragPointerId = event.pointerId;
    moved = false;
    startX = previousX = event.clientX;
    startY = previousY = event.clientY;
  };

  const finishTouchGesture = () => {
    touchGestureActive = false;
    pinchActive = false;
    previousPinchDistance = null;
    dragging = false;
    activeDragPointerId = null;
    moved = false;
  };

  return {
    pointerDown(event: GlobePointerEvent) {
      if (event.pointerType === "touch") {
        if (!touchGestureActive) {
          touchGestureActive = true;
          pinchActive = false;
          moved = false;
        }
        touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touchPointers.size >= 2) {
          dragging = false;
          activeDragPointerId = null;
          pinchActive = true;
          moved = true;
          previousPinchDistance = distanceBetweenTouches();
        } else if (!pinchActive) {
          beginDrag(event);
        }
        return;
      }

      if (touchGestureActive) return;
      beginDrag(event);
    },

    pointerMove(event: GlobePointerEvent) {
      if (event.pointerType === "touch" && touchGestureActive) {
        if (!touchPointers.has(event.pointerId)) return;
        touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touchPointers.size >= 2) {
          const distance = distanceBetweenTouches();
          if (previousPinchDistance !== null) {
            onZoom(THREE.MathUtils.clamp(distance / Math.max(1, previousPinchDistance), 0.5, 2));
          }
          previousPinchDistance = distance;
          return;
        }
        if (pinchActive) return;
      }

      if (!dragging || activeDragPointerId !== event.pointerId) return;
      if (Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY) > 6) moved = true;
      onRotate(event.clientX - previousX, event.clientY - previousY);
      previousX = event.clientX;
      previousY = event.clientY;
    },

    pointerUp(event: GlobePointerEvent) {
      if (event.pointerType === "touch" && touchGestureActive) {
        if (!touchPointers.has(event.pointerId)) return;
        touchPointers.delete(event.pointerId);
        if (touchPointers.size > 0) return;
        if (!pinchActive && !moved) onSelect(event.clientX, event.clientY);
        finishTouchGesture();
        return;
      }

      if (!dragging || activeDragPointerId !== event.pointerId) return;
      dragging = false;
      activeDragPointerId = null;
      if (!moved) onSelect(event.clientX, event.clientY);
    },

    pointerCancel(event: GlobePointerEvent) {
      if (event.pointerType === "touch" && touchGestureActive) {
        touchPointers.delete(event.pointerId);
        if (touchPointers.size === 0) finishTouchGesture();
        else {
          pinchActive = true;
          moved = true;
          previousPinchDistance = null;
          dragging = false;
          activeDragPointerId = null;
        }
        return;
      }
      if (activeDragPointerId === event.pointerId) {
        dragging = false;
        activeDragPointerId = null;
      }
    },

    isInteracting() {
      return dragging || touchPointers.size > 0;
    },
  };
}

function GlobeRenderer({
  points,
  dark,
  selectedId,
  paused,
  zoom,
  onSelect,
  onZoom,
  onReady,
  onFailure,
  onContextRestored,
}: {
  points: GlobePoint[];
  dark: boolean;
  selectedId: string | null;
  paused: boolean;
  zoom: number;
  onSelect: (point: GlobePoint) => void;
  onZoom: (scale: number) => void;
  onReady: (ready: boolean) => void;
  onFailure: (message: string) => void;
  onContextRestored: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const syncZoomRef = useRef<(value: number) => void>(() => undefined);
  const requestDrawRef = useRef<() => void>(() => undefined);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const previousSelectedIdRef = useRef(selectedId);
  const updateSelectionRef = useRef<(previousId: string | null, nextId: string | null) => void>(() => undefined);
  const pausedRef = useRef(paused);
  const callbacksRef = useRef({ onSelect, onReady, onZoom, onFailure, onContextRestored });
  pausedRef.current = paused;
  callbacksRef.current = { onSelect, onReady, onZoom, onFailure, onContextRestored };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      callbacksRef.current.onReady(false);
      callbacksRef.current.onFailure("Interactive rendering is unavailable. Showing the map overview instead.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.maxWidth = "100%";
    renderer.domElement.style.height = "100%";
    // Keep vertical page scrolling native while reserving two-finger pinches for the globe.
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.style.cursor = "grab";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    camera.zoom = zoomRef.current;
    camera.updateProjectionMatrix();
    cameraRef.current = camera;
    const root = new THREE.Group();
    root.rotation.y = THREE.MathUtils.degToRad(95);
    // Center high magnification on a populated region rather than empty equatorial ocean.
    root.rotation.x = 0.52;
    scene.add(root);
    let rendererDisposed = false;
    let contextLost = false;
    let baseTextureFailed = false;
    let animation = 0;
    let renderRequested = true;
    const baseTexture = makeEarthTexture("ftc-globe-world.svg", () => {
      if (rendererDisposed) return;
      baseTextureFailed = true;
      renderer.domElement.style.display = "none";
      callbacksRef.current.onReady(false);
      callbacksRef.current.onFailure("The globe texture could not load. Showing the map overview instead.");
    });
    const earthMaterial = new THREE.MeshStandardMaterial({ map: baseTexture, roughness: 0.92, metalness: 0.02 });
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 48),
      earthMaterial,
    );
    root.add(globe);
    const markerOffsets = getMarkerOffsets(points);
    const markerZoomScale = { value: getGlobeMarkerZoomScale(zoomRef.current) };
    const markerInstances = new Map<string, { mesh: THREE.InstancedMesh; point: GlobePoint; index: number }>();
    const writeMarkerMatrix = (
      mesh: THREE.InstancedMesh,
      point: GlobePoint,
      index: number,
      helper: THREE.Object3D,
      selected: boolean,
      markNeedsUpdate = true,
    ) => {
      const offset = markerOffsets.get(point.id);
      helper.position.copy(pointPosition(point, 1.012, offset?.latitude, offset?.longitude));
      helper.scale.setScalar(selected ? 2 : 1);
      helper.updateMatrix();
      mesh.setMatrixAt(index, helper.matrix);
      if (markNeedsUpdate) mesh.instanceMatrix.needsUpdate = true;
    };
    let detailTexture: THREE.Texture | null = null;
    let detailOverlay: THREE.Mesh | null = null;
    let detailLoadRequested = false;
    let detailLoadAttempted = false;
    let cartographyTexture: THREE.Texture | null = null;
    let cartographyOverlay: THREE.Mesh | null = null;
    let cartographyLoadRequested = false;
    let cartographyLoadAttempted = false;
    let disposed = false;
    const mapTileLoader = new THREE.TextureLoader();
    const loadedMapTiles = new Map<
      string,
      { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; texture: THREE.Texture }
    >();
    const pendingMapTileKeys = new Set<string>();
    const failedMapTileKeys = new Set<string>();
    const mapTileQueue: Array<{ x: number; y: number; z: number; key: string }> = [];
    let desiredMapTileKeys = new Set<string>();
    let activeMapTileLoads = 0;
    let mapTileFailureReported = false;
    let lastMapTileSync = 0;
    let mapTileSyncTimer: ReturnType<typeof setTimeout> | null = null;
    const disposeMapTile = (key: string) => {
      const loaded = loadedMapTiles.get(key);
      if (!loaded) return;
      root.remove(loaded.mesh);
      loaded.mesh.geometry.dispose();
      loaded.mesh.material.dispose();
      loaded.texture.dispose();
      loadedMapTiles.delete(key);
    };
    const loadQueuedMapTiles = () => {
      while (!disposed && activeMapTileLoads < 8 && mapTileQueue.length > 0) {
        const tile = mapTileQueue.shift()!;
        if (!desiredMapTileKeys.has(tile.key)) {
          pendingMapTileKeys.delete(tile.key);
          continue;
        }
        activeMapTileLoads += 1;
        mapTileLoader.load(
          globeMapTileUrl(tile),
          (texture) => {
            activeMapTileLoads -= 1;
            pendingMapTileKeys.delete(tile.key);
            if (disposed || !desiredMapTileKeys.has(tile.key)) {
              texture.dispose();
              loadQueuedMapTiles();
              return;
            }
            texture.colorSpace = THREE.SRGBColorSpace;
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.DoubleSide,
              toneMapped: false,
            });
            const mesh = new THREE.Mesh(createGlobeMapTileGeometry(tile), material);
            mesh.name = `ftc-map-tile:${tile.key}`;
            root.add(mesh);
            loadedMapTiles.set(tile.key, { mesh, texture });
            mapTileFailureReported = false;
            requestDrawRef.current();
            if (!baseTextureFailed && !contextLost) callbacksRef.current.onReady(true);
            loadQueuedMapTiles();
          },
          undefined,
          () => {
            activeMapTileLoads -= 1;
            pendingMapTileKeys.delete(tile.key);
            if (!disposed && desiredMapTileKeys.has(tile.key)) {
              failedMapTileKeys.add(tile.key);
              if (!mapTileFailureReported) {
                mapTileFailureReported = true;
                callbacksRef.current.onFailure("Some close-up map tiles could not load; the globe overview remains available.");
              }
            }
            loadQueuedMapTiles();
          },
        );
      }
    };
    const syncMapTiles = (nextZoom = zoomRef.current) => {
      const center = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion.clone().invert()).normalize();
      const longitude = THREE.MathUtils.radToDeg(Math.atan2(center.x, center.z));
      const latitude = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(center.y, -1, 1)));
      const tiles = shouldUseGlobeCartography(nextZoom)
        ? getGlobeMapTiles(longitude, latitude, nextZoom, camera.aspect)
        : [];
      desiredMapTileKeys = new Set(tiles.map((tile) => tile.key));

      for (const key of loadedMapTiles.keys()) {
        if (!desiredMapTileKeys.has(key)) disposeMapTile(key);
      }
      for (const key of failedMapTileKeys) {
        if (!desiredMapTileKeys.has(key)) failedMapTileKeys.delete(key);
      }
      for (let index = mapTileQueue.length - 1; index >= 0; index -= 1) {
        if (!desiredMapTileKeys.has(mapTileQueue[index].key)) {
          pendingMapTileKeys.delete(mapTileQueue[index].key);
          mapTileQueue.splice(index, 1);
        }
      }
      for (const tile of tiles) {
        if (
          loadedMapTiles.has(tile.key)
          || pendingMapTileKeys.has(tile.key)
          || failedMapTileKeys.has(tile.key)
        ) continue;
        pendingMapTileKeys.add(tile.key);
        mapTileQueue.push(tile);
      }
      loadQueuedMapTiles();
    };
    const scheduleMapTileSync = () => {
      if (mapTileSyncTimer !== null) clearTimeout(mapTileSyncTimer);
      mapTileSyncTimer = setTimeout(() => {
        mapTileSyncTimer = null;
        syncMapTiles();
      }, 400);
    };
    const syncCartography = (nextZoom: number) => {
      if (!shouldUseGlobeCartography(nextZoom)) {
        if (!cartographyOverlay && !cartographyLoadRequested) cartographyLoadAttempted = false;
        if (cartographyOverlay) cartographyOverlay.visible = false;
        return;
      }
      if (cartographyOverlay) {
        cartographyOverlay.visible = true;
        return;
      }
      if (cartographyLoadRequested || cartographyLoadAttempted) return;

      cartographyLoadRequested = true;
      cartographyLoadAttempted = true;
      new THREE.TextureLoader().load(
        `${import.meta.env.BASE_URL}${GLOBE_CARTOGRAPHY_TEXTURE}`,
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.RepeatWrapping;
          texture.repeat.x = 1;
          texture.offset.x = 0.25;
          cartographyTexture = texture;
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
          });
          cartographyOverlay = new THREE.Mesh(new THREE.SphereGeometry(1.003, 64, 48), material);
          cartographyOverlay.visible = shouldUseGlobeCartography(zoomRef.current);
          root.add(cartographyOverlay);
          requestDrawRef.current();
          if (!baseTextureFailed && !contextLost) callbacksRef.current.onReady(true);
        },
        undefined,
        () => {
          if (!disposed) {
            cartographyLoadRequested = false;
            if (!shouldUseGlobeCartography(zoomRef.current)) cartographyLoadAttempted = false;
            callbacksRef.current.onFailure("Some city and water details could not load; the base map remains available.");
          }
        },
      );
    };
    const syncDetail = (nextZoom: number) => {
      if (!shouldUseGlobeDetail(nextZoom)) {
        if (!detailOverlay && !detailLoadRequested) detailLoadAttempted = false;
        if (detailOverlay) detailOverlay.visible = false;
        return;
      }
      if (detailOverlay) {
        detailOverlay.visible = true;
        return;
      }
      if (detailLoadRequested || detailLoadAttempted) return;

      detailLoadRequested = true;
      detailLoadAttempted = true;
      new THREE.TextureLoader().load(
        `${import.meta.env.BASE_URL}${GLOBE_DETAIL_TEXTURE}`,
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.RepeatWrapping;
          texture.repeat.x = 1;
          texture.offset.x = 0.25;
          detailTexture = texture;
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
          });
          detailOverlay = new THREE.Mesh(new THREE.SphereGeometry(1.0015, 64, 48), material);
          detailOverlay.visible = shouldUseGlobeDetail(zoomRef.current);
          root.add(detailOverlay);
          requestDrawRef.current();
          if (!baseTextureFailed && !contextLost) callbacksRef.current.onReady(true);
        },
        undefined,
        () => {
          if (!disposed) {
            detailLoadRequested = false;
            if (!shouldUseGlobeDetail(zoomRef.current)) detailLoadAttempted = false;
            callbacksRef.current.onFailure("Close-up boundaries could not load; the base map remains available.");
          }
        },
      );
    };
    syncZoomRef.current = (value) => {
      const boundedZoom = clampGlobeZoom(value);
      camera.zoom = boundedZoom;
      camera.updateProjectionMatrix();
      markerZoomScale.value = getGlobeMarkerZoomScale(boundedZoom);
      syncDetail(boundedZoom);
      syncCartography(boundedZoom);
      scheduleMapTileSync();
      requestDrawRef.current();
    };
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.025, 48, 36),
      new THREE.MeshBasicMaterial({ color: dark ? 0x81d4be : 0x348c79, transparent: true, opacity: 0.09, side: THREE.BackSide }),
    );
    root.add(atmosphere);
    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const keyLight = new THREE.DirectionalLight(0xfff6dd, dark ? 2.7 : 2.1);
    keyLight.position.set(-3, 2, 4);
    scene.add(keyLight);

    const teamPoints = points.filter((point) => point.kind === "team");
    const eventPoints = points.filter((point) => point.kind === "event");
    const addPointSet = (entries: GlobePoint[], color: number, scale: number) => {
      if (!entries.length) return;
      const geometry = new THREE.SphereGeometry(scale, 8, 6);
      const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      material.onBeforeCompile = (shader) => {
        shader.uniforms.globeMarkerZoomScale = markerZoomScale;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float globeMarkerZoomScale;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed *= globeMarkerZoomScale;");
      };
      material.customProgramCacheKey = () => "ftc-globe-marker-zoom-v1";
      const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
      root.add(mesh);
      const helper = new THREE.Object3D();
      entries.forEach((point, index) => {
        markerInstances.set(point.id, { mesh, point, index });
        writeMarkerMatrix(mesh, point, index, helper, point.id === selectedIdRef.current, false);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    addPointSet(teamPoints, dark ? 0x74e0b3 : 0x087e72, 0.007);
    addPointSet(eventPoints, dark ? 0xffd46c : 0xc17e27, 0.010);
    updateSelectionRef.current = (previousId, nextId) => {
      if (previousId === nextId) return;
      const helper = new THREE.Object3D();
      if (previousId) {
        const previous = markerInstances.get(previousId);
        if (previous) writeMarkerMatrix(previous.mesh, previous.point, previous.index, helper, false);
      }
      if (nextId) {
        const next = markerInstances.get(nextId);
        if (next) writeMarkerMatrix(next.mesh, next.point, next.index, helper, true);
      }
      requestDrawRef.current();
    };

    const gestures = createGlobePointerGestureHandlers({
      onRotate: (deltaX, deltaY) => {
        rotateGlobeFromDrag(root, deltaX, deltaY, getGlobeRotationScale(camera.zoom));
        scheduleMapTileSync();
        requestDrawRef.current();
      },
      onZoom: (scale) => callbacksRef.current.onZoom(scale),
      onSelect: (clientX, clientY) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const point = findGlobePointAtScreen({
          points,
          markerOffsets,
          root,
          camera,
          clientX,
          clientY,
          rect,
        });
        if (point) callbacksRef.current.onSelect(point);
        requestDrawRef.current();
      },
    });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let requestDraw: () => void = () => undefined;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      syncMapTiles();
      requestDraw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    const pointerDown = (event: PointerEvent) => {
      gestures.pointerDown(event);
      if (gestures.isInteracting()) renderer.domElement.style.cursor = "grabbing";
      if (typeof renderer.domElement.setPointerCapture === "function") {
        renderer.domElement.setPointerCapture(event.pointerId);
      }
    };
    const pointerMove = (event: PointerEvent) => {
      gestures.pointerMove(event);
    };
    const pointerUp = (event: PointerEvent) => {
      gestures.pointerUp(event);
      if (!gestures.isInteracting()) renderer.domElement.style.cursor = "grab";
      requestDrawRef.current();
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const pointerCancel = (event: PointerEvent) => {
      gestures.pointerCancel(event);
      if (!gestures.isInteracting()) renderer.domElement.style.cursor = "grab";
      requestDrawRef.current();
    };
    renderer.domElement.addEventListener("pointercancel", pointerCancel);

    const draw = () => {
      animation = 0;
      if (baseTextureFailed || contextLost || rendererDisposed) return;
      const shouldAnimate = !pausedRef.current && !reducedMotion && !gestures.isInteracting();
      if (shouldAnimate) root.rotation.y += 0.0014 * getGlobeRotationScale(camera.zoom);
      const now = performance.now();
      if (shouldAnimate && now - lastMapTileSync >= 750) {
        lastMapTileSync = now;
        syncMapTiles();
      }
      if (renderRequested || shouldAnimate) {
        try {
          renderer.render(scene, camera);
        } catch {
          contextLost = true;
          renderer.domElement.style.display = "none";
          callbacksRef.current.onReady(false);
          callbacksRef.current.onFailure("The globe could not render. Showing the map overview instead.");
          return;
        }
        renderRequested = false;
      }
      if (shouldAnimate) animation = requestAnimationFrame(draw);
    };
    requestDraw = () => {
      renderRequested = true;
      if (!animation) animation = requestAnimationFrame(draw);
    };
    requestDrawRef.current = requestDraw;
    const contextLostHandler = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      renderer.domElement.style.display = "none";
      callbacksRef.current.onReady(false);
      callbacksRef.current.onFailure("The globe renderer stopped unexpectedly. Showing the map overview until it recovers.");
    };
    const contextRestoredHandler = () => {
      if (!rendererDisposed) callbacksRef.current.onContextRestored();
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLostHandler);
    renderer.domElement.addEventListener("webglcontextrestored", contextRestoredHandler);
    syncZoomRef.current(zoomRef.current);
    requestDraw();
    callbacksRef.current.onReady(true);

    return () => {
      rendererDisposed = true;
      disposed = true;
      cancelAnimationFrame(animation);
      if (mapTileSyncTimer !== null) clearTimeout(mapTileSyncTimer);
      observer.disconnect();
      syncZoomRef.current = () => undefined;
      requestDrawRef.current = () => undefined;
      updateSelectionRef.current = () => undefined;
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerCancel);
      renderer.domElement.removeEventListener("webglcontextlost", contextLostHandler);
      renderer.domElement.removeEventListener("webglcontextrestored", contextRestoredHandler);
      cameraRef.current = null;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      baseTexture.dispose();
      detailTexture?.dispose();
      cartographyTexture?.dispose();
      for (const tile of loadedMapTiles.values()) tile.texture.dispose();
      loadedMapTiles.clear();
      pendingMapTileKeys.clear();
      failedMapTileKeys.clear();
      mapTileQueue.length = 0;
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [dark, points]);

  useEffect(() => {
    if (!cameraRef.current) return;
    syncZoomRef.current(zoom);
  }, [zoom]);

  useEffect(() => {
    updateSelectionRef.current(previousSelectedIdRef.current, selectedId);
    previousSelectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    requestDrawRef.current();
  }, [paused]);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function SelectedDetails({ point }: { point: GlobePoint }) {
  const start = formatDate(point.dateStart);
  const end = formatDate(point.dateEnd);
  return (
    <div className="min-w-0" aria-live="polite" data-testid="globe-selected-details">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${point.kind === "team" ? "bg-[#59d8aa]" : "bg-[#efc25e]"}`} />
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[.15em] text-[#a4c8bb]">
          {point.kind === "team" ? `FTC team · ${point.teamNumber ?? "number unavailable"}` : `Competition event · ${point.eventCode ?? "code unavailable"}`}
        </p>
      </div>
      <h3 className="mt-2 truncate text-lg font-semibold tracking-[-.035em] text-[#f2f7ee]" title={point.label}>{point.label}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#b7d1c8]">
        <MapPin size={13} className="shrink-0 text-[#72d8b1]" />
        <span className="truncate">{point.location || "Location not listed"}</span>
      </p>
      <p className="mt-1 text-[10px] text-[#91b2a8]">
        {point.precision === "city" ? "Approximate city location" :
          point.precision === "region" ? "Approximate region location" :
            point.precision === "country" ? "Approximate country location" : "Location not provided by FIRST"}
      </p>
      {point.kind === "team" ? (
        <p className="mt-3 text-[11px] leading-5 text-[#c7d8d0]">
          {[point.schoolName, point.robotName && `Robot: ${point.robotName}`, point.rookieYear && `Rookie ${point.rookieYear}`].filter(Boolean).join(" · ") || "Team details are limited in the current feed."}
        </p>
      ) : (
        <>
          <p className="mt-3 text-[11px] text-[#c7d8d0]">{point.typeName || "FTC event"}{point.venue ? ` · ${point.venue}` : ""}</p>
          {(start || end) && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#a4c8bb]">
              <CalendarDays size={13} /> {start}{end && end !== start ? ` – ${end}` : ""}
            </p>
          )}
        </>
      )}
      {point.website && (
        <a href={point.website} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#72d8b1] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#72d8b1]">
          Visit {point.kind === "team" ? "team" : "event"} site <ArrowUpRight size={12} />
        </a>
      )}
    </div>
  );
}

export function FtcSeasonGlobe() {
  const { data, isLoading, isError, refetch, isFetching } = useGetFtcGlobeData(undefined, {
    query: { queryKey: getGetFtcGlobeDataQueryKey() },
  });
  const [selected, setSelected] = useState<GlobePoint | null>(null);
  const [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_GLOBE_ZOOM);
  const [rendererReady, setRendererReady] = useState(false);
  const [rendererFailure, setRendererFailure] = useState<string | null>(null);
  const [rendererEpoch, setRendererEpoch] = useState(0);
  const [dark, setDark] = useState(false);
  const [visiblePointCount, setVisiblePointCount] = useState(80);
  const points = useMemo(() => data?.points ?? [], [data?.points]);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (selected && !points.some((point) => point.id === selected.id)) setSelected(null);
  }, [points, selected]);

  const choosePoint = (point: GlobePoint) => setSelected(point);
  const teamCount = data?.teamCount ?? 0;
  const eventCount = data?.eventCount ?? 0;

  return (
    <section className="py-14 sm:py-20" aria-labelledby="ftc-globe-title" data-testid="section-ftc-globe">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[.16em] text-[#168b94] dark:text-[#7edbd0]">The current season, in motion</p>
          <h2 id="ftc-globe-title" className="max-w-[680px] text-3xl font-semibold leading-[1.02] tracking-[-.065em] text-[#153642] dark:text-[#e3efeb] sm:text-5xl">
            Robotics is happening everywhere.
          </h2>
          <p className="mt-3 max-w-[560px] text-sm leading-6 text-[#43616a] dark:text-[#aac1be]">
            Explore the teams and events on the FTC map. Select any marker to see the details available for that location.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Metric label="Teams" value={isLoading ? "—" : teamCount.toLocaleString()} />
          <Metric label="Events" value={isLoading ? "—" : eventCount.toLocaleString()} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#2b5961] bg-[#153642] text-[#eaf5f0] shadow-[0_24px_60px_rgba(21,54,66,.17)] dark:border-[#315c61]" data-testid="card-ftc-season-globe">
        <div
          className="grid min-w-0 grid-cols-1 min-h-[440px] lg:grid-cols-[minmax(0,1fr)_300px]"
          data-testid="layout-ftc-season-globe"
        >
          <div
            className="relative min-w-0 min-h-[350px] overflow-hidden sm:min-h-[480px]"
            data-testid="stage-ftc-season-globe"
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.14] [background-image:linear-gradient(rgba(157,221,210,.42)_1px,transparent_1px),linear-gradient(90deg,rgba(157,221,210,.42)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_76%)]" />
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(95%,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#8bc8b6]/20 shadow-[0_0_90px_rgba(66,173,145,.09)]" />
            {data && points.length > 0 && (
              <GlobeRenderer
                key={rendererEpoch}
                points={points}
                dark={dark}
                selectedId={selected?.id ?? null}
                paused={paused}
                zoom={zoom}
                onSelect={choosePoint}
                onZoom={(scale) => setZoom((value) => clampGlobeZoom(value * scale))}
                onReady={(ready) => {
                  setRendererReady(ready);
                  if (ready) setRendererFailure(null);
                }}
                onFailure={setRendererFailure}
                onContextRestored={() => setRendererEpoch((epoch) => epoch + 1)}
              />
            )}
            {data && points.length > 0 && !rendererReady && (
              <img
                src={`${import.meta.env.BASE_URL}ftc-globe-world.svg`}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 m-auto h-[88%] w-[92%] object-contain opacity-90"
                data-testid="image-globe-fallback"
              />
            )}
            {rendererFailure && (
              <p
                className="absolute bottom-16 left-4 right-16 z-10 max-w-xl rounded-lg border border-white/15 bg-[#102a31]/90 px-3 py-2 text-xs leading-5 text-[#d5e8e0] shadow-lg sm:bottom-20 sm:left-6"
                role="status"
                data-testid="status-globe-renderer"
              >
                {rendererFailure}
              </p>
            )}
            {isLoading && <GlobeLoading />}
            {isError && (
              <div className="absolute inset-0 z-10 grid place-items-center p-6">
                <div className="max-w-sm rounded-xl border border-white/15 bg-[#102a31]/95 p-5 text-center shadow-xl">
                  <p className="text-sm font-semibold text-white">The season map could not load.</p>
                  <p className="mt-2 text-xs leading-5 text-[#b7d1c8]">The live FTC data is temporarily unavailable. Try again in a moment.</p>
                  <button type="button" onClick={() => void refetch()} disabled={isFetching} className="mt-4 rounded-lg bg-[#efc34f] px-4 py-2.5 text-xs font-bold text-[#153642] disabled:opacity-60" data-testid="button-globe-retry">
                    {isFetching ? "Retrying…" : "Retry"}
                  </button>
                </div>
              </div>
            )}
            {data && points.length === 0 && !isError && (
              <div className="absolute inset-0 z-10 grid place-items-center p-6">
                <div className="max-w-sm rounded-xl border border-white/15 bg-[#102a31]/90 p-5 text-center">
                  <p className="text-sm font-semibold text-white">No map locations are available yet.</p>
                  <p className="mt-2 text-xs leading-5 text-[#b7d1c8]">There are no published team or event coordinates for this season.</p>
                </div>
              </div>
            )}
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-[#102a31]/80 px-3 py-2 backdrop-blur sm:left-6 sm:top-6">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#71d5ac] opacity-50 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-[#71d5ac]" />
              </span>
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[.13em] text-[#c7ddd4]">FTC · season {data?.season ?? "—"}</span>
            </div>
            <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#102a31]/85 p-1.5 shadow-lg backdrop-blur sm:right-6 sm:top-6" aria-label="Globe zoom controls">
              <button
                type="button"
                aria-label="Zoom out of globe"
                onClick={() => setZoom((value) => stepGlobeZoom(value, -1))}
                disabled={zoom <= MIN_GLOBE_ZOOM}
                className="grid size-9 place-items-center rounded-lg text-[#cde5db] transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#efc34f] disabled:cursor-default disabled:opacity-35"
                data-testid="button-globe-zoom-out"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                aria-label="Reset globe zoom"
                onClick={() => setZoom(1)}
                disabled={zoom === 1}
                className="h-9 min-w-10 rounded-lg px-2 font-mono text-[9px] font-semibold text-[#cde5db] transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#efc34f] disabled:cursor-default disabled:opacity-60"
                data-testid="button-globe-zoom-reset"
              >
                1×
              </button>
              <button
                type="button"
                aria-label="Zoom in on globe"
                onClick={() => setZoom((value) => stepGlobeZoom(value, 1))}
                disabled={zoom >= MAX_GLOBE_ZOOM}
                className="grid size-9 place-items-center rounded-lg text-[#cde5db] transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#efc34f] disabled:cursor-default disabled:opacity-35"
                data-testid="button-globe-zoom-in"
              >
                <ZoomIn size={16} />
              </button>
              <span className="sr-only" role="status" aria-live="polite" data-testid="status-globe-zoom">
                Globe zoom {Math.round(zoom * 100)} percent. Limits {Math.round(MIN_GLOBE_ZOOM * 100)} to {Math.round(MAX_GLOBE_ZOOM * 100)} percent.
              </span>
            </div>
            <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-white/10 bg-[#102a31]/80 px-3 py-2.5 font-mono text-[9px] text-[#c2d8d0] backdrop-blur sm:bottom-6 sm:left-6">
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#59d8aa]" /> TEAMS</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#efc25e]" /> EVENTS</span>
              <span className="hidden text-[#82a79e] sm:inline">DRAG TO ROTATE · USE +/− TO ZOOM · SCROLL PAGE NORMALLY</span>
            </div>
            <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Resume globe rotation" : "Pause globe rotation"} aria-pressed={paused} disabled={points.length === 0} className="absolute bottom-4 right-4 grid size-10 place-items-center rounded-full border border-white/15 bg-[#102a31]/85 text-[#cde5db] transition hover:bg-[#24505a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#efc34f] disabled:opacity-50 sm:bottom-6 sm:right-6" data-testid="button-globe-rotation">
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            {rendererReady && <span className="sr-only" role="status">Interactive FTC globe loaded with {points.length.toLocaleString()} locations.</span>}
          </div>

          <aside className="flex min-w-0 min-h-[300px] flex-col border-t border-white/10 bg-[#102a31]/65 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[.15em] text-[#82aaa0]">Selected location</p>
                <p className="mt-1 text-[11px] text-[#b7d1c8]">Choose a marker on the globe</p>
              </div>
              <button type="button" aria-label="Clear selected location" onClick={() => setSelected(null)} disabled={!selected} className="grid size-9 place-items-center rounded-lg border border-white/10 text-[#aac8be] transition hover:text-white disabled:cursor-default disabled:opacity-35" data-testid="button-globe-clear">
                <RotateCcw size={14} />
              </button>
            </div>
            <div className="mt-5 min-h-[128px]">
              {selected ? <SelectedDetails point={selected} /> : (
                <p className="max-w-[230px] text-sm leading-6 text-[#91b2a8]">Team and event information appears here when you select a location.</p>
              )}
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[.13em] text-[#82aaa0]">Browse locations</p>
              <div className="max-h-[190px] space-y-1 overflow-y-auto pr-1" aria-label="FTC team and event locations">
                {points.slice(0, visiblePointCount).map((point) => (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => choosePoint(point)}
                    aria-pressed={selected?.id === point.id}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[11px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#efc34f] ${selected?.id === point.id ? "bg-white/10 text-white" : "text-[#b7d1c8] hover:bg-white/[.06] hover:text-white"}`}
                    data-testid={`button-globe-point-${point.kind}-${point.id}`}
                  >
                    <span className={`size-1.5 shrink-0 rounded-full ${point.kind === "team" ? "bg-[#59d8aa]" : "bg-[#efc25e]"}`} />
                    <span className="min-w-0 flex-1 truncate">{point.label}</span>
                    <span className="font-mono text-[8px] uppercase tracking-[.08em] text-[#82a79e]">{point.kind}</span>
                  </button>
                ))}
                {points.length > visiblePointCount && (
                  <button
                    type="button"
                    onClick={() => setVisiblePointCount((count) => Math.min(count + 80, points.length))}
                    className="mt-1 w-full rounded-lg px-2.5 py-2 text-left text-[10px] font-semibold text-[#72d8b1] hover:bg-white/[.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#efc34f]"
                    data-testid="button-globe-more-points"
                  >
                    Show {Math.min(80, points.length - visiblePointCount)} more of {points.length.toLocaleString()} locations
                  </button>
                )}
                {!isLoading && points.length === 0 && !isError && <p className="px-2.5 py-2 text-xs text-[#91b2a8]">No published locations.</p>}
              </div>
            </div>
          </aside>
        </div>
        <div className="flex flex-col justify-between gap-2 border-t border-white/10 px-5 py-3 font-mono text-[9px] uppercase tracking-[.1em] text-[#82aaa0] sm:flex-row sm:items-center sm:px-6">
          <span>One marker per current-season team or event</span>
          <span>{data ? `${points.length.toLocaleString()} records · live FIRST season feed` : "Loading current season feed"}</span>
        </div>
        <div className="flex flex-col gap-1 border-t border-white/10 px-5 py-3 text-[10px] leading-5 text-[#a8c4bb] sm:px-6">
          <p>Locations are approximate city, region, or country estimates, not team addresses. Records without usable FIRST locations are grouped at an unknown-location placeholder; overlapping markers are slightly spread apart for selection.</p>
          <p>
            High-zoom map tiles from <a className="underline underline-offset-2 hover:text-white" href="https://www.openstreetmap.de/" target="_blank" rel="noreferrer">OpenStreetMap Deutschland</a>. Map data © <a className="underline underline-offset-2 hover:text-white" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> (ODbL). Coordinate source: <a className="underline underline-offset-2 hover:text-white" href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> (CC BY 4.0). World map, 1:10m close-up boundaries, major rivers, lakes, and cities: <a className="underline underline-offset-2 hover:text-white" href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a> (public domain).
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-5 rounded-2xl border border-[#c8ded7] bg-[#e6f1eb] p-5 dark:border-[#315a5f] dark:bg-[#122f36] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-7" data-testid="card-ftc-platform-promo">
        <div>
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-[#087e72] dark:text-[#7edbd0]">A shared home for robotics teams</p>
          <h3 className="mt-2 max-w-[680px] text-2xl font-semibold leading-tight tracking-[-.045em] text-[#153642] dark:text-[#e3efeb] sm:text-3xl">
            Give your team one place to build the whole season.
          </h3>
          <p className="mt-2 max-w-[720px] text-sm leading-6 text-[#43616a] dark:text-[#aac1be]">
            Bring team chat, shared boards, CAD and 3D reviews, planning, and AI tools together—so the work behind your robot stays connected.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <a
            href="/auth?createTeam=1"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#153642] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#214e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168b94] dark:bg-[#efc34f] dark:text-[#153642] dark:hover:bg-[#ffda79]"
            data-testid="link-ftc-platform-signup"
          >
            Start your team — free <ArrowUpRight size={15} />
          </a>
          <a
            href="#capabilities"
            className="inline-flex min-h-10 items-center gap-2 px-1 text-sm font-semibold text-[#087e72] underline decoration-[#87b9ad] underline-offset-4 transition hover:text-[#153642] dark:text-[#7edbd0] dark:hover:text-white"
            data-testid="link-ftc-platform-capabilities"
          >
            Explore platform tools <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-[82px] rounded-xl border border-[#d9e6e1] bg-white/70 px-3 py-2.5 dark:border-[#28464d] dark:bg-[#122a32]">
    <span className="block font-mono text-[9px] uppercase tracking-[.13em] text-[#70868b] dark:text-[#91aaa8]">{label}</span>
    <strong className="mt-1 block text-lg leading-none tracking-[-.04em] text-[#153642] dark:text-[#e3efeb]">{value}</strong>
  </div>;
}

function GlobeLoading() {
  return (
    <div className="absolute inset-0 grid place-items-center" role="status" aria-label="Loading FTC season locations">
      <div className="relative grid size-[min(72vw,330px)] place-items-center rounded-full border border-[#95cfc0]/20">
        <div className="absolute inset-[9%] animate-pulse rounded-full bg-[#2a6970]/60 motion-reduce:animate-none" />
        <div className="absolute inset-[9%] rounded-full border border-dashed border-[#9bcfc1]/30" />
        <div className="relative h-3/4 w-3/4 animate-pulse rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(198,224,210,.75),rgba(74,132,119,.68)_42%,rgba(23,56,63,.95)_75%)] motion-reduce:animate-none" />
        <span className="absolute bottom-[-28px] font-mono text-[9px] uppercase tracking-[.14em] text-[#9ec0b7]">Fetching live season locations</span>
      </div>
    </div>
  );
}
