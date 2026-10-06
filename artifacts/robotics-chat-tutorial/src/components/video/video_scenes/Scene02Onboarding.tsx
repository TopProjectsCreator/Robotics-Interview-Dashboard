import { motion } from 'framer-motion';
import { ArrowRight, Check, Plus, UserRoundPlus } from 'lucide-react';
import { SceneFrame } from './shared';

export function Scene02Onboarding() {
  return (
    <SceneFrame
      number={2}
      caption="Choose “Add a team member,” enter a name, and set a password."
      duration={6}
      handoff="split"
      className="scene-onboarding"
    >
      <div className="onboarding-title">
        <span className="onboarding-kicker">TEAM ACCESS · STEP 02</span>
        <h1>Who are<br /><em>you?</em></h1>
        <p>Your own account keeps team conversations clear and private.</p>
      </div>
      <div className="onboarding-panel">
        <div className="onboarding-panel-top">
          <motion.span
            className="onboarding-avatar"
            initial={{ y: 0, scale: 1 }}
            animate={{ y: [0, -8, -17], scale: [1, 1.04, 1.12] }}
            transition={{ delay: 5.12, duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          >
            AL
          </motion.span>
          <span><b>Choose your account</b><small>Join the robotics workspace</small></span>
        </div>
        <motion.div className="onboarding-add" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.14, duration: 0.42 }}>
          <UserRoundPlus size={18} />
          <span>Add a team member</span>
          <Plus className="onboarding-add-plus" size={16} />
        </motion.div>
        <div className="onboarding-rule"><span>NEW TEAM MEMBER</span></div>
        <motion.div className="onboarding-field" initial={{ opacity: 0.65 }} animate={{ opacity: 1 }} transition={{ delay: 0.48, duration: 0.25 }}>
          <label>Interviewer name</label>
          <div className="mock-input onboarding-name">Avery Lane<span className="typing-caret" /></div>
        </motion.div>
        <motion.div className="onboarding-field onboarding-field--password" initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.3 }}>
          <label>Personal password</label>
          <div className="mock-input mock-input--masked onboarding-password">••••••••<span className="password-check"><Check size={14} /></span></div>
          <small>Only Avery can use this password.</small>
        </motion.div>
        <motion.div
          className="mock-button mock-button--teal onboarding-submit focus-outline"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: [0.98, 1.04, 1] }}
          transition={{ delay: 4.42, duration: 0.48 }}
        >
          Create password and continue <ArrowRight size={16} />
        </motion.div>
      </div>
      <motion.div className="onboarding-code-chip" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.22, duration: 0.36 }}>
        <span>TEAM CODE</span><b>hi</b><i>already entered</i>
      </motion.div>
    </SceneFrame>
  );
}
