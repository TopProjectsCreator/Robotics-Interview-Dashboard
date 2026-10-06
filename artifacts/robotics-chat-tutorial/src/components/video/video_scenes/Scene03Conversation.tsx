import { motion } from 'framer-motion';
import { LockKeyhole, MessageCircle, Send } from 'lucide-react';
import { AppPanel, Avatar, SceneFrame } from './shared';

export function Scene03Conversation() {
  return (
    <SceneFrame
      number={3}
      caption="Use Team for everyone, or select a teammate for a private DM."
      duration={5}
      handoff="right"
      className="scene-conversation"
    >
      <div className="conversation-label">
        <span>ONE WORKSPACE</span>
        <h1>One room.<br /><em>Two ways in.</em></h1>
      </div>
      <AppPanel className="conversation-panel">
        <div className="conversation-top">
          <div className="conversation-switcher">
            <span className="switcher-label">CONVERSATION</span>
            <motion.span
              className="conversation-tab conversation-tab--team"
              animate={{ backgroundColor: ['#183a4b', '#183a4b', '#f7faf9'], borderColor: ['#183a4b', '#183a4b', '#d5e0e0'], color: ['#ffffff', '#ffffff', '#52666e'] }}
              transition={{ delay: 1.82, duration: 0.34 }}
            >
              <MessageCircle size={15} /> Team
            </motion.span>
            <motion.span
              className="conversation-tab conversation-tab--dm"
              initial={{ backgroundColor: '#ffffff', borderColor: '#d5e0e0', color: '#52666e', scale: 0.96 }}
              animate={{ backgroundColor: '#e3f4f2', borderColor: '#9ed3ce', color: '#12737d', scale: [0.96, 1.04, 1] }}
              transition={{ delay: 1.82, duration: 0.38 }}
            >
              <span className="tab-focus-dot" /> To Casey Rivera
            </motion.span>
          </div>
          <span className="conversation-private"><LockKeyhole size={13} /> PRIVATE DM</span>
        </div>
        <motion.div
          className="conversation-message conversation-message--team"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: [1, 1, 0], y: [0, 0, -8] }}
          transition={{ delay: 1.82, duration: 0.32 }}
        >
          <Avatar initials="AL" tone="gold" />
          <div className="conversation-bubble"><b>Avery Lane <small>4:22 PM</small></b><p>Drive test moved to 4:30. Bring the spare wheels.</p></div>
        </motion.div>
        <motion.div className="conversation-message conversation-message--dm" initial={{ opacity: 0.3, x: 15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 2.02, duration: 0.38 }}>
          <Avatar initials="CR" tone="blue" />
          <div className="conversation-bubble conversation-bubble--dm"><b>Casey Rivera <small>just now · only you two</small></b><p>Can you check the intake sensor?</p></div>
        </motion.div>
        <div className="conversation-compose">
          <span className="conversation-compose-copy">
            <motion.span initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 1.82, duration: 0.18 }}>Message the team or type @ to mention</motion.span>
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.98, duration: 0.2 }}>Message Casey or type @ to mention</motion.span>
          </span>
          <span className="conversation-send"><Send size={14} /></span>
        </div>
      </AppPanel>
      <div className="conversation-rail">
        <div className="conversation-rail-line" />
        <span className="conversation-rail-note">TEAM<br />EVERYONE</span>
        <span className="conversation-rail-note conversation-rail-note--dm">DM<br />JUST YOU TWO</span>
      </div>
    </SceneFrame>
  );
}
