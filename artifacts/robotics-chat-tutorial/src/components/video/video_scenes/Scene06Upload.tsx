import { motion } from 'framer-motion';
import { Check, FileText, Paperclip, Upload } from 'lucide-react';
import { AppPanel, SceneFrame } from './shared';

export function Scene06Upload() {
  return (
    <SceneFrame
      number={6}
      caption="Attach a file directly in the conversation."
      duration={4}
      handoff="fold"
      className="scene-upload"
    >
      <div className="upload-orbit" aria-hidden="true" />
      <div className="upload-heading">
        <span className="upload-kicker">KEEP THE WORK TOGETHER</span>
        <h1>Drop it<br /><em>in the chat.</em></h1>
        <p>Share plans, checklists, and reference files right where the team needs them.</p>
      </div>
      <AppPanel className="upload-panel">
        <div className="upload-chat-row"><span className="upload-chat-avatar">AL</span><span><b>Avery Lane</b><small>Team · just now</small></span></div>
        <div className="upload-composer">
          <span className="upload-plus">+</span>
          <span className="upload-compose-text">Add a note or attach a file</span>
          <motion.span className="upload-attach-action" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45, duration: 0.3 }}>Attach files</motion.span>
          <motion.span className="upload-paperclip focus-outline" initial={{ rotate: -24, scale: 0.88 }} animate={{ rotate: [0, -8, 0], scale: [1, 1.16, 1] }} transition={{ delay: 0.65, duration: 0.5 }}><Paperclip size={21} /></motion.span>
        </div>
        <div className="upload-picker">
          <div className="upload-picker-title"><Upload size={15} /> Select a file</div>
          <div className="upload-file-row">
            <span className="upload-file-icon"><FileText size={20} /></span>
            <span className="upload-file-copy"><b>robot-checklist.pdf</b><small>PDF · 2.4 MB</small></span>
            <motion.span className="upload-file-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2.4, type: 'spring', stiffness: 280, damping: 18 }}><Check size={16} /></motion.span>
          </div>
          <div className="upload-status"><i /> Added to team chat</div>
        </div>
        <div className="upload-thread-line" />
      </AppPanel>
      <div className="upload-type-tags"><span>DOCUMENTS</span><span>IMAGES</span><span>3D MODELS</span><span>AUDIO</span></div>
    </SceneFrame>
  );
}
