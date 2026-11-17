import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getGetFtcGlobeDataQueryKey, useGetFtcGlobeData } from "@workspace/api-client-react";
import type { FtcGlobePoint } from "@workspace/api-client-react";
import { ArrowUpRight, CalendarDays, MapPin, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

type GlobePoint = FtcGlobePoint;
const MIN_GLOBE_ZOOM = 0.75;
const MAX_GLOBE_ZOOM = 2.2;
const GLOBE_ZOOM_STEP = 0.2;

export function pointPosition(point: GlobePoint, radius: number, latitudeOffset = 0, longitudeOffset = 0) {
  const lat = THREE.MathUtils.degToRad(point.latitude + latitudeOffset);
  const lon = THREE.MathUtils.degToRad(point.longitude + longitudeOffset);
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  );
}

function makeEarthTexture() {
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}ftc-globe-world.svg`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  // Sphere U and east-positive longitude now advance in the same direction.
  texture.repeat.x = 1;
  texture.offset.x = 0.25;
  return texture;
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

function GlobeRenderer({
  points,
  dark,
  selectedId,
  paused,
  zoom,
  onSelect,
  onReady,
}: {
  points: GlobePoint[];
  dark: boolean;
  selectedId: string | null;
  paused: boolean;
  zoom: number;
  onSelect: (point: GlobePoint) => void;
  onReady: (ready: boolean) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pausedRef = useRef(paused);
  const callbacksRef = useRef({ onSelect, onReady });
  pausedRef.current = paused;
  callbacksRef.current = { onSelect, onReady };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      callbacksRef.current.onReady(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "pan-y pinch-zoom";
    renderer.domElement.style.cursor = "grab";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    cameraRef.current = camera;
    const root = new THREE.Group();
    root.rotation.y = THREE.MathUtils.degToRad(100);
    scene.add(root);
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 48),
      new THREE.MeshStandardMaterial({ map: makeEarthTexture(), roughness: 0.92, metalness: 0.02 }),
    );
    root.add(globe);
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
    const markerOffsets = getMarkerOffsets(points);
    const meshData: { mesh: THREE.InstancedMesh; points: GlobePoint[] }[] = [];
    const addPointSet = (entries: GlobePoint[], color: number, scale: number) => {
      if (!entries.length) return;
      const geometry = new THREE.SphereGeometry(scale, 8, 6);
      const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
      const helper = new THREE.Object3D();
      entries.forEach((point, index) => {
        const offset = markerOffsets.get(point.id);
        helper.position.copy(pointPosition(point, 1.012, offset?.latitude, offset?.longitude));
        helper.scale.setScalar(point.id === selectedId ? scale * 2 : 1);
        helper.updateMatrix();
        mesh.setMatrixAt(index, helper.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      root.add(mesh);
      meshData.push({ mesh, points: entries });
    };
    addPointSet(teamPoints, dark ? 0x74e0b3 : 0x087e72, 0.007);
    addPointSet(eventPoints, dark ? 0xffd46c : 0xc17e27, 0.010);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false;
    let previousX = 0;
    let previousY = 0;
    let startX = 0;
    let startY = 0;
    let moved = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    const pointerDown = (event: PointerEvent) => {
      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      previousX = event.clientX;
      previousY = event.clientY;
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (dragging) {
        if (Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY) > 6) moved = true;
        root.rotation.y += (event.clientX - previousX) * 0.006;
        root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + (event.clientY - previousY) * 0.004, -0.65, 0.65);
        previousX = event.clientX;
        previousY = event.clientY;
      }
    };
    const pointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      renderer.domElement.style.cursor = "grab";
      if (moved) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshData.map((entry) => entry.mesh), false)[0];
      if (hit?.instanceId !== undefined) {
        const entry = meshData.find((item) => item.mesh === hit.object);
        const point = entry?.points[hit.instanceId];
        if (point) callbacksRef.current.onSelect(point);
      }
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const pointerCancel = () => {
      dragging = false;
      renderer.domElement.style.cursor = "grab";
    };
    renderer.domElement.addEventListener("pointercancel", pointerCancel);

    let animation = 0;
    const draw = () => {
      animation = requestAnimationFrame(draw);
      if (!pausedRef.current && !reducedMotion && !dragging) root.rotation.y += 0.0014;
      renderer.render(scene, camera);
    };
    draw();
    callbacksRef.current.onReady(true);

    return () => {
      cancelAnimationFrame(animation);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerCancel);
      cameraRef.current = null;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if ("map" in material && material.map) material.map.dispose();
            material.dispose();
          });
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [dark, points, selectedId]);

  useEffect(() => {
    if (!cameraRef.current) return;
    cameraRef.current.zoom = zoom;
    cameraRef.current.updateProjectionMatrix();
  }, [zoom]);

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
  const [zoom, setZoom] = useState(1.2);
  const [rendererReady, setRendererReady] = useState(false);
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
        <div className="grid min-h-[440px] lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="relative min-h-[350px] overflow-hidden sm:min-h-[480px]">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.14] [background-image:linear-gradient(rgba(157,221,210,.42)_1px,transparent_1px),linear-gradient(90deg,rgba(157,221,210,.42)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_76%)]" />
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(95%,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#8bc8b6]/20 shadow-[0_0_90px_rgba(66,173,145,.09)]" />
            {data && points.length > 0 && (
              <GlobeRenderer points={points} dark={dark} selectedId={selected?.id ?? null} paused={paused} zoom={zoom} onSelect={choosePoint} onReady={setRendererReady} />
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
                onClick={() => setZoom((value) => Math.max(MIN_GLOBE_ZOOM, Number((value - GLOBE_ZOOM_STEP).toFixed(2))))}
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
                onClick={() => setZoom((value) => Math.min(MAX_GLOBE_ZOOM, Number((value + GLOBE_ZOOM_STEP).toFixed(2))))}
                disabled={zoom >= MAX_GLOBE_ZOOM}
                className="grid size-9 place-items-center rounded-lg text-[#cde5db] transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#efc34f] disabled:cursor-default disabled:opacity-35"
                data-testid="button-globe-zoom-in"
              >
                <ZoomIn size={16} />
              </button>
              <span className="sr-only" role="status" aria-live="polite" data-testid="status-globe-zoom">
                Globe zoom {Math.round(zoom * 100)} percent.
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

          <aside className="flex min-h-[300px] flex-col border-t border-white/10 bg-[#102a31]/65 p-5 sm:p-6 lg:border-l lg:border-t-0">
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
            Coordinate source: <a className="underline underline-offset-2 hover:text-white" href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> (CC BY 4.0). World map: <a className="underline underline-offset-2 hover:text-white" href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>.
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
