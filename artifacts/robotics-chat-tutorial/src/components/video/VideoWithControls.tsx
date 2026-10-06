import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SCENE_DURATIONS } from './VideoTemplate';
import VideoTemplate from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  access: { title: 'Team access', filePath: 'src/components/video/video_scenes/Scene01Access.tsx' },
  onboarding: { title: 'Add a team member', filePath: 'src/components/video/video_scenes/Scene02Onboarding.tsx' },
  conversation: { title: 'Team chat and DMs', filePath: 'src/components/video/video_scenes/Scene03Conversation.tsx' },
  formatting: { title: 'Format a message', filePath: 'src/components/video/video_scenes/Scene04Formatting.tsx' },
  poll: { title: 'Post a poll', filePath: 'src/components/video/video_scenes/Scene05Poll.tsx' },
  upload: { title: 'Upload a file', filePath: 'src/components/video/video_scenes/Scene06Upload.tsx' },
  messageActions: { title: 'Edit or delete a message', filePath: 'src/components/video/video_scenes/Scene07MessageActions.tsx' },
  voice: { title: 'Dictate and record audio', filePath: 'src/components/video/video_scenes/Scene08Voice.tsx' },
  board: { title: 'Create and share a board', filePath: 'src/components/video/video_scenes/Scene09Board.tsx' },
  document: { title: 'Create and share a document', filePath: 'src/components/video/video_scenes/Scene10Document.tsx' },
  spreadsheet: { title: 'Create and share a spreadsheet', filePath: 'src/components/video/video_scenes/Scene11Spreadsheet.tsx' },
  outro: { title: 'Return to the dashboard', filePath: 'src/components/video/video_scenes/Scene12Outro.tsx' },
};

function announceSceneSelection(index: number, sceneKeys: string[]) {
  const key = sceneKeys[index];
  const details = SCENE_DETAILS[key];
  if (!details?.filePath) return;

  window.parent.postMessage(
    {
      type: 'REPLIT_VIDEO_SCENE_SELECTED',
      payload: {
        sceneIndex: index,
        sceneCount: sceneKeys.length,
        sceneTitle: details.title || key,
        filePath: details.filePath,
        lineNumber: 1,
      },
    },
    '*',
  );
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const [muted, setMuted] = useState(false);
  const handlePreviewAudioBlocked = useCallback(() => setMuted(true), []);
  const {
    sceneKeys,
    activeIndex,
    locked,
    paused,
    mountKey,
    tick,
    durations,
    activeDuration,
    activeStartTime,
    totalDuration,
    onSceneChange,
    jumpTo,
    toggleLock,
    togglePause,
  } = useSceneControls(SCENE_DURATIONS);

  const sensorRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);

  const handleJumpTo = useCallback((index: number) => {
    jumpTo(index);
    announceSceneSelection(index, sceneKeys);
  }, [jumpTo, sceneKeys]);

  useEffect(() => {
    if (!paused) return;
    const frozen = document
      .getAnimations()
      .filter((animation) => animation.playState === 'running');
    frozen.forEach((animation) => animation.pause());
    return () => frozen.forEach((animation) => animation.play());
  }, [paused]);

  const handlePointerEnter = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(true);
  }, []);

  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(false);
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    if (collapsed) setTapPinned(true);
  }, [collapsed]);

  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((current) => !current);
    setHovering(false);
    setTapPinned(false);
  }, []);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      const sensor = sensorRef.current;
      if (sensor && !sensor.contains(event.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', onDocumentPointerDown);
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
  }, [collapsed, tapPinned]);

  if (!isIframed) return <VideoTemplate />;

  const barVisible = !collapsed || hovering || tapPinned;

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <VideoTemplate
        key={mountKey}
        durations={durations}
        loop
        paused={paused}
        muted={muted}
        previewControls
        onSceneChange={onSceneChange}
        onAudioBlocked={handlePreviewAudioBlocked}
      />
      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="w-full flex-1" aria-hidden="true" />
        <ControlBar
          visible={barVisible}
          collapsed={collapsed}
          locked={locked}
          paused={paused}
          muted={muted}
          sceneKeys={sceneKeys}
          activeIndex={activeIndex}
          activeDuration={activeDuration}
          activeStartTime={activeStartTime}
          totalDuration={totalDuration}
          tick={tick}
          onTogglePause={togglePause}
          onToggleLock={toggleLock}
          onToggleMute={() => setMuted((current) => !current)}
          onJumpTo={handleJumpTo}
          onToggleCollapsed={handleToggleCollapsed}
        />
      </div>
    </div>
  );
}

interface ControlBarProps {
  visible: boolean;
  collapsed: boolean;
  locked: boolean;
  paused: boolean;
  muted: boolean;
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  onTogglePause: () => void;
  onToggleLock: () => void;
  onToggleMute: () => void;
  onJumpTo: (index: number) => void;
  onToggleCollapsed: () => void;
}

function ControlBar({
  visible,
  collapsed,
  locked,
  paused,
  muted,
  sceneKeys,
  activeIndex,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  onTogglePause,
  onToggleLock,
  onToggleMute,
  onJumpTo,
  onToggleCollapsed,
}: ControlBarProps) {
  const iconClass = 'h-8 w-8';
  const buttonClass = 'flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white';

  return (
    <div
      className={`flex items-center gap-3 bg-black/60 px-5 py-4 backdrop-blur-sm transition-all duration-200 ease-out ${
        visible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-full opacity-0'
      }`}
      aria-hidden={!visible}
    >
      <button
        type="button"
        onClick={onTogglePause}
        className={buttonClass}
        disabled={!visible}
        title={paused ? 'Play' : 'Pause'}
        aria-label={paused ? 'Play' : 'Pause'}
      >
        {paused ? <Play className={iconClass} /> : <Pause className={iconClass} />}
      </button>
      <button
        type="button"
        onClick={onToggleLock}
        className={`${buttonClass} ${locked ? 'bg-white/15 text-white hover:bg-white/25' : ''}`}
        disabled={!visible}
        title={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-pressed={locked}
      >
        <Repeat className={iconClass} />
      </button>
      <button
        type="button"
        onClick={onToggleMute}
        className={buttonClass}
        disabled={!visible}
        title={muted ? 'Unmute preview audio' : 'Mute preview audio'}
        aria-label={muted ? 'Unmute preview audio' : 'Mute preview audio'}
        aria-pressed={muted}
      >
        {muted ? <VolumeX className={iconClass} /> : <Volume2 className={iconClass} />}
      </button>

      <div className="w-px self-stretch bg-white/15" aria-hidden="true" />

      <PlaybackStatus
        sceneKeys={sceneKeys}
        activeIndex={activeIndex}
        activeDuration={activeDuration}
        activeStartTime={activeStartTime}
        totalDuration={totalDuration}
        tick={tick}
        paused={paused}
        disabled={!visible}
        onJumpTo={onJumpTo}
      />

      <button
        type="button"
        onClick={onToggleCollapsed}
        className={buttonClass}
        disabled={!visible}
        title={collapsed ? 'Show controls' : 'Hide controls'}
        aria-label={collapsed ? 'Show controls' : 'Hide controls'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronUp className="h-10 w-10" /> : <ChevronDown className="h-10 w-10" />}
      </button>
    </div>
  );
}

function PlaybackStatus({
  sceneKeys,
  activeIndex,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  paused,
  disabled,
  onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  paused: boolean;
  disabled: boolean;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBaseRef = useRef(0);

  useEffect(() => {
    setElapsed(0);
    elapsedBaseRef.current = 0;
  }, [tick]);

  useEffect(() => {
    if (paused) return;
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      setElapsed(elapsedBaseRef.current + performance.now() - startedAt);
    }, 60);
    return () => {
      window.clearInterval(interval);
      elapsedBaseRef.current += performance.now() - startedAt;
    };
  }, [tick, paused]);

  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(
    totalDuration,
    activeStartTime + Math.min(elapsed, activeDuration),
  );

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {sceneKeys.map((key, index) => {
          const fill = index < activeIndex ? 100 : index === activeIndex ? progress * 100 : 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onJumpTo(index)}
              disabled={disabled}
              className="relative h-3 min-h-3 min-w-0 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20 transition-all hover:h-4 hover:bg-white/25"
              aria-label={`Jump to scene ${index + 1}`}
              aria-current={index === activeIndex ? 'true' : undefined}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-white/90 transition-[width] duration-100"
                style={{ width: `${fill}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="shrink-0 font-mono text-xl tabular-nums text-white/70">
        {activeIndex + 1}/{sceneKeys.length}
      </div>
      <div
        className="min-w-[11ch] shrink-0 text-right font-mono text-xl tabular-nums text-white/85"
        role="timer"
        aria-label={`Playback time ${formatPlaybackTime(totalElapsed)} of ${formatPlaybackTime(totalDuration)}`}
      >
        {formatPlaybackTime(totalElapsed)} / {formatPlaybackTime(totalDuration)}
      </div>
    </>
  );
}

function formatPlaybackTime(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
