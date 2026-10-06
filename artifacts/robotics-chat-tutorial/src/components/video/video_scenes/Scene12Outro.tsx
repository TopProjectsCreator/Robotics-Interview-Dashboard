import { motion } from 'framer-motion';
import { SceneFrame } from './shared';

export function Scene12Outro() {
  return (
    <SceneFrame
      number={12}
      caption="Open the team dashboard to start collaborating."
      duration={4}
      handoff="logo"
      className="scene-outro"
    >
      <div className="outro-sweep" aria-hidden="true" />
      <motion.div className="outro-lockup" initial={{ x: '-50%', scale: 0.92, opacity: 0 }} animate={{ x: '-50%', scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <span className="outro-brand-mark">R</span>
        <div><span>ROBOTICS</span><small>TEAM 23442</small></div>
      </motion.div>
      <motion.div className="outro-url-card" initial={{ x: '-50%', y: 14, opacity: 0 }} animate={{ x: '-50%', y: 0, opacity: 1 }} transition={{ delay: 0.18, duration: 0.46 }}>
        <span className="outro-url-label">TEAM DASHBOARD</span>
        <strong>https://robotics-interview-dashboard.onrender.com/dashboard</strong>
        <motion.span className="outro-url-underline" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.68, duration: 0.6, ease: 'easeOut' }} />
      </motion.div>
      <motion.div className="outro-code" initial={{ x: '-50%', scale: 0.9, opacity: 0 }} animate={{ x: '-50%', scale: 1, opacity: 1 }} transition={{ delay: 0.42, duration: 0.4 }}>
        <span>TEAM ACCESS CODE</span><b>hi</b>
      </motion.div>
      <div className="outro-mantra">CHAT <i>·</i> SHARE <i>·</i> BUILD</div>
      <div className="outro-caption-rule" />
    </SceneFrame>
  );
}
