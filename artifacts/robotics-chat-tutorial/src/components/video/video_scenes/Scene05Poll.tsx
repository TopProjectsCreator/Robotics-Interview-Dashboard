import { motion } from 'framer-motion';
import { BarChart3, Check, Send } from 'lucide-react';
import { SceneFrame } from './shared';

export function Scene05Poll() {
  return (
    <SceneFrame
      number={5}
      caption="Add a question and choices, then post a poll."
      duration={5}
      handoff="bar"
      className="scene-poll"
    >
      <div className="poll-backdrop-word">DECIDE<br /><span>TOGETHER</span></div>
      <motion.div className="poll-launch-chip" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
        <BarChart3 size={15} /> Create poll
      </motion.div>
      <div className="poll-form">
        <div className="poll-heading">
          <span className="poll-icon"><BarChart3 size={20} /></span>
          <span><b>New poll</b><small>Get the team's input</small></span>
          <span className="poll-live-dot" />
        </div>
        <div className="poll-question-label">QUESTION</div>
        <div className="poll-question">Which prototype should we test first?</div>
        <div className="poll-option-row"><span className="poll-radio" />Drive base <span className="poll-option-spark" /></div>
        <div className="poll-option-row"><span className="poll-radio" />Intake</div>
        <motion.div className="mock-button mock-button--teal poll-submit" initial={{ scale: 0.98 }} animate={{ scale: [0.98, 1.03, 1] }} transition={{ delay: 2.55, duration: 0.38 }}>
          <Send size={15} /> Post poll
        </motion.div>
        <motion.div className="poll-result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.44, duration: 0.32 }}>
          <div className="poll-result-line"><span>Drive base</span><b>67%</b></div>
          <div className="poll-track"><motion.i initial={{ width: '4%' }} animate={{ width: '67%' }} transition={{ delay: 3.3, duration: 0.48, ease: 'easeOut' }} /></div>
          <div className="poll-result-line poll-result-line--second"><span>Intake</span><b>33%</b></div>
          <div className="poll-track poll-track--muted"><motion.i initial={{ width: '2%' }} animate={{ width: '33%' }} transition={{ delay: 3.38, duration: 0.44, ease: 'easeOut' }} /></div>
          <span className="poll-vote"><Check size={12} /> 3 votes</span>
        </motion.div>
      </div>
      <div className="poll-side-caption"><span>QUICK INPUT</span><b>One question.<br />Clear next step.</b></div>
    </SceneFrame>
  );
}
