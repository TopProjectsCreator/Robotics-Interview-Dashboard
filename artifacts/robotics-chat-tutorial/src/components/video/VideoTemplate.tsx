import { useEffect, useRef, type ComponentType } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { Scene01Access } from './video_scenes/Scene01Access';
import { Scene02Onboarding } from './video_scenes/Scene02Onboarding';
import { Scene03Conversation } from './video_scenes/Scene03Conversation';
import { Scene04Formatting } from './video_scenes/Scene04Formatting';
import { Scene05Poll } from './video_scenes/Scene05Poll';
import { Scene06Upload } from './video_scenes/Scene06Upload';
import { Scene07MessageActions } from './video_scenes/Scene07MessageActions';
import { Scene08Voice } from './video_scenes/Scene08Voice';
import { Scene09Board } from './video_scenes/Scene09Board';
import { Scene10Document } from './video_scenes/Scene10Document';
import { Scene11Spreadsheet } from './video_scenes/Scene11Spreadsheet';
import { Scene12Outro } from './video_scenes/Scene12Outro';
import './robotics-tutorial.css';

export const SCENE_DURATIONS: Record<string, number> = {
  access: 4000,
  onboarding: 6000,
  conversation: 5000,
  formatting: 4000,
  poll: 5000,
  upload: 4000,
  messageActions: 5000,
  voice: 6000,
  board: 6000,
  document: 6000,
  spreadsheet: 5000,
  outro: 4000,
};

const SCENE_COMPONENTS: Record<string, ComponentType> = {
  access: Scene01Access,
  onboarding: Scene02Onboarding,
  conversation: Scene03Conversation,
  formatting: Scene04Formatting,
  poll: Scene05Poll,
  upload: Scene06Upload,
  messageActions: Scene07MessageActions,
  voice: Scene08Voice,
  board: Scene09Board,
  document: Scene10Document,
  spreadsheet: Scene11Spreadsheet,
  outro: Scene12Outro,
};

const FOCUS_TARGETS = [
  { left: 78, top: 49 },
  { left: 68, top: 26 },
  { left: 57, top: 22 },
  { left: 41, top: 75 },
  { left: 15, top: 64 },
  { left: 87, top: 35 },
  { left: 82, top: 43 },
  { left: 81, top: 34 },
  { left: 17, top: 40 },
  { left: 18, top: 39 },
  { left: 18, top: 35 },
  { left: 78, top: 49 },
];

const FOCUS_DELAYS = [1.78, 4.42, 1.82, 0.7, 0.2, 0.7, 0.75, 0, 1, 1, 0.8];

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';

interface VideoTemplateProps {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  previewControls?: boolean;
  onSceneChange?: (sceneKey: string) => void;
  onAudioBlocked?: () => void;
}

const SCENE_START_SEC: Record<string, number> = (() => {
  const starts: Record<string, number> = {};
  let elapsedMs = 0;
  for (const [key, duration] of Object.entries(SCENE_DURATIONS)) {
    starts[key] = elapsedMs / 1000;
    elapsedMs += duration;
  }
  return starts;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  previewControls = false,
  onSceneChange,
  onAudioBlocked,
}: VideoTemplateProps = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneKeyRef = useRef<string | null>(null);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];
  const focus = FOCUS_TARGETS[sceneIndex] ?? FOCUS_TARGETS[0];
  const isOutro = baseSceneKey === 'outro';

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.45;
    if (paused) {
      audio.pause();
      return;
    }

    if (lastSceneKeyRef.current !== currentSceneKey) {
      lastSceneKeyRef.current = currentSceneKey;
      const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
        audio.currentTime = targetTime;
      }
    }

    audio.play().catch((error: unknown) => {
      onAudioBlocked?.();
      console.warn(
        '[robotics-chat-tutorial] Preview audio could not start; use the volume control to retry.',
        error,
      );
    });
  }, [baseSceneKey, currentSceneKey, muted, onAudioBlocked, paused]);

  return (
    <VideoCanvas
      aspectRatio={VIDEO_ASPECT_RATIO}
      className={previewControls ? 'video-with-controls' : undefined}
      style={{ backgroundColor: 'var(--tutorial-navy)' }}
    >
      <VideoPausedContext.Provider value={paused}>
        <motion.div
          className="tutorial-camera"
          initial={false}
          animate={{
            scale: 1.014 + Math.max(sceneIndex, 0) * 0.00035,
            rotateZ: (((Math.max(sceneIndex, 0) % 3) - 1) * 0.24),
          }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <LayoutGroup id="robotics-chat-tutorial-scenes">
            <AnimatePresence mode="sync">
              {SceneComponent && <SceneComponent key={currentSceneKey} />}
            </AnimatePresence>
          </LayoutGroup>
        </motion.div>
        <motion.div
          className="tutorial-focus-carrier"
          initial={{ opacity: 0 }}
          animate={{
            left: `${focus.left}%`,
            top: `${focus.top}%`,
            opacity: isOutro ? [0, 1, 1, 0] : [0, 0, 1],
          }}
          transition={{
            left: isOutro
              ? { duration: 0 }
              : { type: 'spring', stiffness: 185, damping: 26 },
            top: isOutro
              ? { duration: 0 }
              : { type: 'spring', stiffness: 185, damping: 26 },
            opacity: isOutro
              ? { delay: 3.2, duration: 0.8, ease: 'linear', times: [0, 0.1, 0.62, 1] }
              : { delay: FOCUS_DELAYS[sceneIndex] ?? 0, duration: 0.32 },
          }}
          aria-hidden="true"
        />
      </VideoPausedContext.Provider>
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
        style={{ display: 'none' }}
      />
    </VideoCanvas>
  );
}
