import { motion } from 'framer-motion';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { SceneFrame } from './shared';

export function Scene01Access() {
  return (
    <SceneFrame
      number={1}
      caption="Open the dashboard with your team access code."
      duration={4}
      handoff="radial"
      className="scene-access"
    >
      <div className="access-grid" aria-hidden="true" />
      <div className="access-orbit access-orbit--one" aria-hidden="true" />
      <div className="access-copy">
        <motion.p className="access-eyebrow" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12, duration: 0.42 }}>
          A shared space for the whole team
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.55 }}>
          ROBOTICS<br /><em>IN MOTION.</em>
        </motion.h1>
        <motion.div className="access-url-wrap" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.48, duration: 0.42 }}>
          <span>OPEN THE TEAM DASHBOARD</span>
          <strong>https://robotics-interview-dashboard.onrender.com/dashboard</strong>
        </motion.div>
        <div className="access-footnote">INTERVIEWS · CHAT · SHARED TOOLS</div>
      </div>

      <motion.div className="access-login-card" initial={{ opacity: 0, x: 36, rotate: 1.2 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ delay: 0.2, duration: 0.62 }}>
        <div className="access-card-head">
          <span className="access-lock"><LockKeyhole size={20} /></span>
          <div><strong>Team access</strong><small>Enter your team code to continue</small></div>
        </div>
        <label className="mock-field-label">Team access code</label>
        <div className="mock-input mock-input--masked">
          <span className="access-mask-group">
            {['•', '•', '•', '•'].map((dot, index) => (
              <motion.i key={index} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.56 + index * 0.13, duration: 0.16 }}>
                {dot}
              </motion.i>
            ))}
          </span>
          <LockKeyhole size={16} />
        </div>
        <div className="access-code-badge"><span>TEAM ACCESS CODE</span><b>hi</b></div>
        <motion.div
          className="mock-button mock-button--teal focus-outline access-continue-button"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: [0.98, 1.04, 1] }}
          transition={{ delay: 1.78, duration: 0.44 }}
        >
          Continue <ArrowRight size={16} />
        </motion.div>
        <div className="access-card-note"><span className="status-dot" /> Team workspace · secured</div>
      </motion.div>
      <div className="access-sweep" aria-hidden="true" />
    </SceneFrame>
  );
}
