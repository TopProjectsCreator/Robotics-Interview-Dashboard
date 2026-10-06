import { motion } from 'framer-motion';
import { Check, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Avatar, AppPanel, SceneFrame } from './shared';

export function Scene07MessageActions() {
  return (
    <SceneFrame
      number={7}
      caption="Edit your note—or remove an outdated message."
      duration={5}
      handoff="radial"
      className="scene-message-actions"
    >
      <div className="message-actions-heading">
        <span>KEEP THE THREAD CURRENT</span>
        <h1>Good notes<br /><em>stay useful.</em></h1>
      </div>
      <AppPanel className="message-actions-panel">
        <div className="message-actions-context"><span className="active-channel-dot" /> Team conversation <span>·</span> Today</div>
        <div className="editable-message">
          <Avatar initials="AL" tone="gold" small />
          <div className="message-actions-bubble">
            <div className="message-author-line"><b>Avery Lane</b><small>4:28 PM</small><span className="edited-label">EDITING</span></div>
            <motion.div className="message-edit-menu" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.26 }}><Pencil size={12} /> Edit</motion.div>
            <motion.div className="message-before-edit" initial={{ opacity: 1, y: 0 }} animate={{ opacity: [1, 1, 0], y: [0, 0, -5] }} transition={{ delay: 0.92, duration: 0.32 }}>
              Bring the test chassis to bay 2.
            </motion.div>
            <motion.div className="message-inline-edit" initial={{ opacity: 0, y: 5, borderColor: 'rgba(22,134,154,.18)' }} animate={{ opacity: 1, y: 0, borderColor: ['rgba(22,134,154,.18)', 'rgba(22,134,154,.85)', 'rgba(22,134,154,.85)'] }} transition={{ delay: 1.18, duration: 0.48 }}>
              Bring the test chassis to bay 2; add spare wheels.
              <span className="typing-caret" />
            </motion.div>
            <motion.span className="message-save-button" initial={{ scale: 0.94 }} animate={{ scale: [0.94, 1.07, 1] }} transition={{ delay: 1.62, duration: 0.38 }}><Check size={13} /> Save</motion.span>
          </div>
          <span className="message-more"><MoreHorizontal size={20} /></span>
        </div>
        <div className="message-edit-confirm"><Check size={13} /> Message updated</div>
        <div className="outdated-message">
          <Avatar initials="CR" tone="blue" small />
          <div className="outdated-bubble"><b>Casey Rivera <small>4:02 PM</small></b><p>Old setup details.</p></div>
          <motion.div className="delete-menu" initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 2.72, duration: 0.36 }}>
            <span><Pencil size={13} /> Edit</span>
            <span className="delete-menu-item"><Trash2 size={13} /> Delete</span>
          </motion.div>
        </div>
        <motion.div className="message-deleted-toast" initial={{ opacity: 0, scale: 0.94, y: 5 }} animate={{ opacity: [0, 1, 1], scale: [0.94, 1, 1], y: [5, 0, 0] }} transition={{ delay: 3.68, duration: 0.48 }}>
          <Check size={14} /> Message deleted
        </motion.div>
        <div className="message-compose-ghost">Write a message…</div>
      </AppPanel>
    </SceneFrame>
  );
}
