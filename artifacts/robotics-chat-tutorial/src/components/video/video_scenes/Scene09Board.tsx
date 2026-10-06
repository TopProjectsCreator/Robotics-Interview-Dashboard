import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, Check, ClipboardList, MoreHorizontal, Plus } from 'lucide-react';
import { SceneFrame } from './shared';

export function Scene09Board() {
  return (
    <SceneFrame
      number={9}
      caption="Create a shared board to track tasks and handoffs."
      duration={6}
      handoff="fold"
      className="scene-board"
    >
      <div className="board-create-menu">
        <span className="board-menu-kicker">WHAT WOULD YOU LIKE TO CREATE?</span>
        <div className="board-menu-choice"><span className="board-choice-icon"><ClipboardList size={19} /></span><span><b>Board</b><small>Track tasks, handoffs, and dates</small></span><ArrowRight size={15} /></div>
        <div className="board-menu-other"><span><Plus size={13} /> Document</span><span>Spreadsheet</span></div>
      </div>
      <motion.div className="board-canvas" initial={{ rotateX: 5, scale: 0.96, opacity: 0 }} animate={{ rotateX: 0, scale: 1, opacity: 1 }} transition={{ delay: 0.82, duration: 0.58, ease: [0.22, 1, 0.36, 1] }}>
        <div className="board-toolbar">
          <div className="board-title-mark"><ClipboardList size={16} /><span>Interview coordination board</span><i>SHARED</i></div>
          <div className="board-avatars"><span>AL</span><span>CR</span><MoreHorizontal size={15} /></div>
        </div>
        <div className="board-columns">
          <div className="board-column">
            <div className="board-column-heading"><span>To do</span><b>2</b><Plus size={14} /></div>
            <div className="board-task board-task--yellow"><small>BUILD</small><b>Build intake sensor jig</b><span><CalendarDays size={12} /> Today <i>AL</i></span></div>
            <div className="board-task board-task--blue"><small>TEST</small><b>Check spare wheels</b><span><CalendarDays size={12} /> Fri <i>CR</i></span></div>
          </div>
          <div className="board-column">
            <div className="board-column-heading"><span>In progress</span><b>1</b><Plus size={14} /></div>
            <motion.div className="board-task board-task--teal" initial={{ y: 22, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.65, duration: 0.4 }}><small>DRIVE TEAM</small><b>Review drive test</b><span><CalendarDays size={12} /> Today <i>AL</i></span></motion.div>
          </div>
          <div className="board-column">
            <div className="board-column-heading"><span>Done</span><b>1</b><Plus size={14} /></div>
            <div className="board-task board-task--done"><small><Check size={10} /> COMPLETE</small><b>Charge test battery</b><span>Finished <i>CR</i></span></div>
          </div>
        </div>
        <div className="board-share-toast"><Check size={13} /> Shared in team chat</div>
      </motion.div>
    </SceneFrame>
  );
}
