import { motion } from 'framer-motion';
import { Bold, Code2, Italic, Send } from 'lucide-react';
import { AppPanel, SceneFrame } from './shared';

export function Scene04Formatting() {
  return (
    <SceneFrame
      number={4}
      caption="Use formatting to make important details easy to scan."
      duration={4}
      handoff="down"
      className="scene-formatting"
    >
      <div className="formatting-word">MAKE IT<br /><em>SCANNABLE.</em></div>
      <div className="formatting-annotation"><span /> Markdown formatting is supported</div>
      <AppPanel className="formatting-panel">
        <div className="formatting-context">
          <span className="formatting-thread-dot" />
          <span><b>Team conversation</b><small>Sharing a quick update</small></span>
        </div>
        <div className="formatting-message">
          <span className="formatting-message-label">MESSAGE PREVIEW</span>
          <p>Drive practice starts at <strong>6:30.</strong></p>
        </div>
        <div className="formatting-composer">
          <div className="formatting-input"><span>Drive practice starts at </span><b>6:30.</b><i className="typing-caret" /></div>
          <div className="formatting-toolbar">
            <motion.span className="format-tool format-tool--active" initial={{ scale: 0.9 }} animate={{ scale: [0.9, 1.15, 1] }} transition={{ delay: 1.1, duration: 0.36 }}><Bold size={18} /></motion.span>
            <span className="format-tool"><Italic size={17} /></span>
            <span className="format-tool"><Code2 size={17} /></span>
            <span className="formatting-toolbar-copy">BOLD · ITALIC · CODE</span>
            <span className="format-send"><Send size={15} /></span>
          </div>
        </div>
      </AppPanel>
      <motion.div className="formatting-bold-signal" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 2.08, duration: 0.48, ease: 'easeOut' }} />
    </SceneFrame>
  );
}
