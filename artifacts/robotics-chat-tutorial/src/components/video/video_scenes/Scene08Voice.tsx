import { motion } from 'framer-motion';
import { Mic, Type, AudioLines, Square } from 'lucide-react';
import { AppPanel, SceneFrame } from './shared';

const WAVE_HEIGHTS = [20, 34, 48, 29, 58, 38, 70, 42, 62, 31, 50, 76, 39, 57, 24, 46, 68, 33, 53, 28, 61, 40, 72, 31, 49, 22, 56, 36, 66, 28, 45];

export function Scene08Voice() {
  return (
    <SceneFrame
      number={8}
      caption="Dictate a text draft or record a short audio message."
      duration={6}
      handoffDuration={0.32}
      handoff="bar"
      className="scene-voice"
    >
      <div className="voice-heading">
        <span className="voice-kicker">HANDS-FREE INPUT</span>
        <h1>Say it.<br /><em>Send it.</em></h1>
        <p>Choose text dictation or an audio message from the mic menu.</p>
      </div>
      <AppPanel className="voice-panel">
        <div className="voice-context"><span className="voice-dot" /> Team conversation <span className="voice-context-right">Message the team</span></div>
        <div className="voice-workspace">
          <div className="voice-compose-column">
            <div className="voice-draft-label">DICTATED TEXT</div>
            <div className="voice-draft">
              <motion.span className="voice-draft-copy" initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }} transition={{ delay: 0.82, duration: 0.92, ease: 'linear' }}>
                The robot is ready for a drive test.
              </motion.span>
              <motion.i className="voice-transcript-cursor" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.7, repeat: 2 }} />
            </div>
            <motion.div className="voice-menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.38 }}>
              <span className="voice-menu-title">VOICE INPUT</span>
              <motion.div className="voice-menu-option voice-menu-option--dictate focus-outline" initial={{ scale: 0.97 }} animate={{ scale: [0.97, 1.03, 1] }} transition={{ delay: 0.24, duration: 0.36 }}><Type size={16} /><b>Dictate text</b><small>Speak into the message box</small></motion.div>
              <motion.div className="voice-menu-option voice-menu-option--record" initial={{ backgroundColor: '#ffffff' }} animate={{ backgroundColor: ['#ffffff', '#e9f8f6', '#e9f8f6'] }} transition={{ delay: 1.74, duration: 0.42 }}>
                <Mic size={16} /><b>Record audio</b><small>Send your voice as an audio file</small>
              </motion.div>
            </motion.div>
          </div>
          <div className="voice-record-column">
            <span className="voice-record-eyebrow">AUDIO MESSAGE</span>
            <motion.div className="voice-record-card" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.96, 0.96, 1, 1, 0.98] }} transition={{ duration: 4.55, times: [0, 0.5, 0.58, 0.9, 1], ease: 'easeInOut' }}>
              <div className="voice-record-top"><span className="voice-record-indicator" /><b>Recording audio</b><span className="voice-record-time">00:03</span><span className="voice-stop"><Square size={12} fill="currentColor" /></span></div>
              <div className="voice-wave" aria-hidden="true">
                {WAVE_HEIGHTS.map((height, index) => (
                  <motion.i key={index} style={{ height: `${height}%` }} initial={{ scaleY: 0.22, opacity: 0.3 }} animate={{ scaleY: [0.22, 1, 0.5, 0.86, 0.08], opacity: [0.3, 1, 1, 1, 0.7] }} transition={{ delay: 2.58 + index * 0.008, duration: 1.72, times: [0, 0.22, 0.46, 0.72, 1], ease: 'easeInOut' }} />
                ))}
              </div>
            </motion.div>
            <motion.div className="voice-ready-card" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 4.62, duration: 0.42 }}>
              <span className="voice-ready-icon"><AudioLines size={16} /></span>
              <span><b>Voice message</b><small>Audio · 0:03</small></span>
              <span className="voice-ready-play" aria-hidden="true">▶</span>
            </motion.div>
          </div>
        </div>
      </AppPanel>
      <div className="voice-no-speech"><span /> NO VOICE-OVER IN THIS TUTORIAL</div>
    </SceneFrame>
  );
}
