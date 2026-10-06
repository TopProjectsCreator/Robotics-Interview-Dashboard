import { motion } from 'framer-motion';
import { Check, FileText, Share2 } from 'lucide-react';
import { SceneFrame } from './shared';

export function Scene10Document() {
  return (
    <SceneFrame
      number={10}
      caption="Create a shared document for team notes and plans."
      duration={6}
      handoff="down"
      className="scene-document"
    >
      <div className="document-create-menu">
        <span className="document-menu-kicker">WHAT WOULD YOU LIKE TO CREATE?</span>
        <div className="document-menu-choice"><FileText size={18} /><span><b>Document</b><small>Collaborative notes and plans</small></span><Check size={14} /></div>
        <div className="document-menu-other">Whiteboard <span>Board</span></div>
      </div>
      <div className="document-toolbar">
        <span className="document-type"><FileText size={18} /> DOCUMENT</span>
        <span className="document-shared"><Check size={13} /> Shared in team chat</span>
      </div>
      <motion.div className="document-page" initial={{ y: 24, rotate: -1.2, opacity: 0.4 }} animate={{ y: 0, rotate: 0, opacity: 1 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
        <div className="document-page-top"><span>TEAM NOTES</span><span>EDITING TOGETHER <i>AL</i><i>CR</i></span></div>
        <div className="document-title">Drive test<br />checklist<span className="document-title-caret" /></div>
        <div className="document-rule" />
        <div className="document-section-title">Before the test</div>
        <div className="document-check-row"><span className="document-check" />Check wheel fasteners</div>
        <div className="document-check-row"><span className="document-check" />Charge the battery</div>
        <motion.div className="document-check-row document-check-row--last" initial={{ opacity: 0.4, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.68, duration: 0.36 }}><span className="document-check document-check--complete"><Check size={11} /></span>Record results</motion.div>
        <div className="document-cursor-note"><span /> Casey is editing</div>
      </motion.div>
      <motion.div className="document-share-stamp" initial={{ scale: 0.82, opacity: 0, rotate: -4 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ delay: 2.74, type: 'spring', stiffness: 220, damping: 20 }}>
        <Share2 size={14} /><span>IN-APP · SHARED DOCUMENT</span>
      </motion.div>
    </SceneFrame>
  );
}
