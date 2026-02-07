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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: colors.surface0, color: colors.textPrimary }}>
      {/* Header */}
      <header style={{
        padding: '10px 24px',
        borderBottom: `1px solid ${colors.borderDefault}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: `linear-gradient(180deg, ${colors.surface1} 0%, ${colors.surface0} 100%)`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/valhalla-logo.svg" alt="Valhalla" width={32} height={32} style={{ display: 'block' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1 style={{
              margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: 3,
              background: 'linear-gradient(135deg, #38BDF8, #FACC15)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>VALHALLA</h1>
            <span style={{ color: colors.textDim, fontSize: 11, fontWeight: 500, letterSpacing: 0.5 }}>Post-IP Networking Stack</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setShowApiDocs(true)}
            style={{
              background: `rgba(56, 189, 248, 0.08)`,
              border: `1px solid rgba(56, 189, 248, 0.25)`,
              color: colors.accentBlue,
              borderRadius: 6,
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: 0.5,
              transition: 'all 0.15s',
            }}
          >
            API Docs
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: nodes.length > 0 ? 'rgba(78, 203, 113, 0.08)' : 'rgba(248, 81, 73, 0.08)', border: `1px solid ${nodes.length > 0 ? 'rgba(78, 203, 113, 0.25)' : 'rgba(248, 81, 73, 0.25)'}` }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: nodes.length > 0 ? colors.online : colors.offline,
              boxShadow: nodes.length > 0 ? `0 0 8px ${colors.online}60` : 'none',
            }} />
            <span style={{ color: nodes.length > 0 ? colors.online : colors.offline, fontSize: 12, fontWeight: 600 }}>
              {nodes.length > 0 ? `${nodes.length} nodes` : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ display: 'flex', borderBottom: `1px solid ${colors.borderDefault}`, paddingLeft: 24, position: 'relative', background: colors.surface1 }}>
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
                color: isActive ? colors.textPrimary : colors.textDim,
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
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
