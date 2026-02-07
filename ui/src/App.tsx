import { useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useValhalla } from './hooks/useValhalla';
import { useValhallaStore } from './store/useValhallaStore';
import { NetworkGraph } from './components/NetworkGraph';
import { StackView } from './components/StackView';
import { DemoRunner } from './components/DemoRunner';
import { EventLog } from './components/EventLog';
import { ApiDocs } from './components/ApiDocs';
import { colors } from './theme';
import './App.css';

type Tab = 'network' | 'stack' | 'demos';

const tabs: { id: Tab; label: string }[] = [
  { id: 'network', label: 'Network' },
  { id: 'stack', label: 'Stack' },
  { id: 'demos', label: 'Demos' },
];

const tabContentVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function App() {
  useValhalla();
  const activeTab = useValhallaStore((s) => s.activeTab);
  const setActiveTab = useValhallaStore((s) => s.setActiveTab);
  const events = useValhallaStore((s) => s.events);
  const nodes = useValhallaStore((s) => s.nodes);
  const [showApiDocs, setShowApiDocs] = useState(false);

  const lastLayerEvent = [...events].reverse().find((e) => e.layer !== 'demo');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: colors.surface0, color: '#fff' }}>
      {/* Header */}
      <header style={{
        padding: '12px 24px',
        borderBottom: '1px solid rgba(74, 158, 255, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(180deg, rgba(74, 158, 255, 0.04) 0%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{
            margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: 3,
            background: 'linear-gradient(135deg, #4a9eff, #7b68ee)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>VALHALLA</h1>
          <span style={{ color: colors.textDim, fontSize: 12, fontWeight: 500 }}>Proof of Concept</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowApiDocs(true)}
            style={{
              background: 'rgba(74, 158, 255, 0.08)',
              border: '1px solid rgba(74, 158, 255, 0.25)',
              color: colors.accentBlue,
              borderRadius: 6,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: 0.5,
              transition: 'all 0.15s',
            }}
          >
            API Docs
          </button>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: nodes.length > 0 ? colors.online : colors.offline,
            boxShadow: nodes.length > 0 ? `0 0 8px ${colors.online}60` : 'none',
          }} />
          <span style={{ color: nodes.length > 0 ? colors.textSecondary : colors.accentRed, fontSize: 13 }}>
            {nodes.length > 0 ? `${nodes.length} nodes` : 'Disconnected'}
          </span>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ display: 'flex', borderBottom: `1px solid ${colors.borderDefault}`, paddingLeft: 24, position: 'relative' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? `2px solid ${colors.accentBlue}` : '2px solid transparent',
                color: isActive ? '#fff' : colors.textDim,
                padding: '12px 20px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 700 : 400,
                transition: 'all 0.2s ease',
                letterSpacing: 0.3,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel */}
        <AnimatePresence mode="wait">
          <m.div
            key={activeTab}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.15 }}
            style={{ flex: 1, overflow: 'auto', padding: 0 }}
          >
            {activeTab === 'network' && <NetworkGraph />}
            {activeTab === 'stack' && <StackView activeLayer={lastLayerEvent?.layer} />}
            {activeTab === 'demos' && <DemoRunner />}
          </m.div>
        </AnimatePresence>

        {/* Right Panel - Event Log */}
        <div style={{ width: 360, borderLeft: `1px solid ${colors.borderDefault}`, padding: 12 }}>
          <EventLog />
        </div>
      </div>

      {/* API Docs Modal */}
      {showApiDocs && <ApiDocs onClose={() => setShowApiDocs(false)} />}
    </div>
  );
}

export default App;
