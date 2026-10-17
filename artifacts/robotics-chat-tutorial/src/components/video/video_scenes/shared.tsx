import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { SafeFrame } from '@/lib/video';
import { BrandMark } from '../../BrandMark';

export type HandoffKind =
  | 'radial'
  | 'split'
  | 'right'
  | 'fold'
  | 'down'
  | 'bar'
  | 'left'
  | 'cells'
  | 'logo';

const HANDOFF_MASKS: Record<HandoffKind, { from: string; to: string }> = {
  radial: {
    from: 'circle(0% at 76% 70%)',
    to: 'circle(155% at 76% 70%)',
  },
  split: { from: 'inset(0 50% 0 50%)', to: 'inset(0 0 0 0)' },
  right: { from: 'inset(0 100% 0 0)', to: 'inset(0 0 0 0)' },
  fold: {
    from: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)',
    to: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
  },
  down: { from: 'inset(100% 0 0 0)', to: 'inset(0 0 0 0)' },
  bar: { from: 'inset(47% 0 47% 0)', to: 'inset(0 0 0 0)' },
  left: { from: 'inset(0 0 0 100%)', to: 'inset(0 0 0 0)' },
  cells: { from: 'inset(50% 50% 50% 50%)', to: 'inset(0 0 0 0)' },
  logo: {
    from: 'circle(0% at 50% 52%)',
    to: 'circle(155% at 50% 52%)',
  },
};

interface SceneFrameProps {
  number: number;
  caption: string;
  duration: number;
  handoffDuration?: number;
  handoff: HandoffKind;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function SceneFrame({
  number,
  caption,
  duration,
  handoffDuration = 0.82,
  handoff,
  children,
  className = '',
  style,
}: SceneFrameProps) {
  const mask = HANDOFF_MASKS[handoff];

  return (
    <motion.section
      className={`tutorial-scene ${className}`}
      style={style}
      initial={{ opacity: 1, scale: 1.025, filter: 'blur(2px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.055, filter: 'blur(5px)' }}
      transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
      aria-label={`Tutorial shot ${number}: ${caption}`}
    >
      <SafeFrame className="tutorial-safe-frame">
        <div className="tutorial-brand">
          <BrandMark />
          <span className="tutorial-brand-copy">
            <strong>ROBOTICS</strong>
            <small>TEAM 23442</small>
          </span>
        </div>
        {children}
        <div className="tutorial-caption">
          <span className="tutorial-caption-step">
            CHAT GUIDE <b>{String(number).padStart(2, '0')}</b> / 12
          </span>
          <p>{caption}</p>
        </div>
      </SafeFrame>
      <motion.div
        className="tutorial-handoff"
        initial={{ clipPath: mask.from, opacity: 0 }}
        animate={{ clipPath: mask.to, opacity: 1 }}
        transition={{
          delay: Math.max(0, duration - handoffDuration),
          duration: handoffDuration,
          ease: [0.76, 0, 0.24, 1],
        }}
        aria-hidden="true"
      />
    </motion.section>
  );
}

interface PanelProps {
  children: ReactNode;
  className?: string;
}

export function AppPanel({ children, className = '' }: PanelProps) {
  return (
    <div className={`app-panel ${className}`}>
      <div className="app-panel-topbar">
        <span className="window-dots"><i /><i /><i /></span>
        <span>ROBOTICS WORKSPACE</span>
        <span className="app-panel-lock">PRIVATE TEAM</span>
      </div>
      {children}
    </div>
  );
}

interface AvatarProps {
  initials: string;
  tone?: 'teal' | 'gold' | 'blue';
  small?: boolean;
}

export function Avatar({ initials, tone = 'teal', small = false }: AvatarProps) {
  return (
    <span className={`avatar avatar--${tone}${small ? ' avatar--small' : ''}`}>
      {initials}
    </span>
  );
}

export function FocusOutline({ children, className = '' }: PanelProps) {
  return <div className={`focus-outline ${className}`}>{children}</div>;
}

export function MotionIn({
  children,
  className = '',
  delay = 0,
  y = 16,
  style,
}: PanelProps & { delay?: number; y?: number; style?: CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.46, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
