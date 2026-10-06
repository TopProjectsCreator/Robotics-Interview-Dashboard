import { motion } from 'framer-motion';
import { Check, FileSpreadsheet } from 'lucide-react';
import { SceneFrame } from './shared';

const SHEET_ROWS = [
  ['01', '93%', '84'],
  ['02', '88%', '91'],
];

export function Scene11Spreadsheet() {
  return (
    <SceneFrame
      number={11}
      caption="Create a shared spreadsheet for tryout notes."
      duration={5}
      handoff="cells"
      className="scene-spreadsheet"
    >
      <div className="spreadsheet-create-menu">
        <span className="spreadsheet-menu-kicker">WHAT WOULD YOU LIKE TO CREATE?</span>
        <div className="spreadsheet-menu-choice"><FileSpreadsheet size={18} /><span><b>Spreadsheet</b><small>A shared worksheet for tryout notes</small></span><Check size={14} /></div>
        <div className="spreadsheet-menu-other">Document <span>Board</span></div>
      </div>
      <div className="spreadsheet-heading">
        <span className="spreadsheet-kicker">THE TEAM'S WORKSHEET</span>
        <h1>Keep every<br /><em>run in view.</em></h1>
      </div>
      <motion.div className="spreadsheet-window" initial={{ scale: 0.94, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}>
        <div className="spreadsheet-topline"><span className="spreadsheet-file-icon"><FileSpreadsheet size={18} /></span><span><b>Tryout worksheet</b><small>Team workspace · shared</small></span><span className="spreadsheet-shared-pill"><Check size={12} /> Shared in team chat</span></div>
        <div className="spreadsheet-grid">
          <div className="sheet-cell sheet-cell--corner">#</div>
          <div className="sheet-cell sheet-cell--head">Run</div>
          <div className="sheet-cell sheet-cell--head">Battery</div>
          <div className="sheet-cell sheet-cell--head">Score</div>
          {SHEET_ROWS.flatMap((row, rowIndex) => [
            <div className="sheet-cell sheet-cell--rownum" key={`rn-${rowIndex}`}>{rowIndex + 1}</div>,
            ...row.map((cell, colIndex) => (
              <motion.div
                className={`sheet-cell${colIndex === 0 ? ' sheet-cell--run' : ''}`}
                key={`${rowIndex}-${colIndex}`}
                initial={{ backgroundColor: '#fff' }}
                animate={{ backgroundColor: ['#fff', rowIndex === 0 ? '#fff7d7' : '#e7f6f4', '#fff'] }}
                transition={{ delay: 0.85 + rowIndex * 0.28 + colIndex * 0.12, duration: 0.6 }}
              >{cell}</motion.div>
            )),
          ])}
        </div>
        <div className="spreadsheet-footer"><span><i /> Avery and Casey can edit</span><b>IN-APP SPREADSHEET</b></div>
      </motion.div>
    </SceneFrame>
  );
}
