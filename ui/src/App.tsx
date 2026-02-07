import { useValhalla } from './hooks/useValhalla';
import { useValhallaStore } from './store/useValhallaStore';
import { NetworkGraph } from './components/NetworkGraph';
import { StackView } from './components/StackView';
import { DemoRunner } from './components/DemoRunner';
import { TrustGraph } from './components/TrustGraph';
import { EventLog } from './components/EventLog';
import './App.css';

type Tab = 'network' | 'stack' | 'demos' | 'trust';

const tabs: { id: Tab; label: string }[] = [
  { id: 'network', label: 'Network' },
  { id: 'stack', label: 'Stack' },
  { id: 'demos', label: 'Demos' },
  { id: 'trust', label: 'Trust' },
];

function App() {
  useValhalla();
  const activeTab = useValhallaStore((s) => s.activeTab);
  const setActiveTab = useValhallaStore((s) => s.setActiveTab);
  const events = useValhallaStore((s) => s.events);
  const nodes = useValhallaStore((s) => s.nodes);

  const lastLayerEvent = [...events].reverse().find((e) => e.layer !== 'demo');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f23', color: '#fff' }}>
      {/* Header */}
      <header style={{ padding: '12px 24px', borderBottom: '1px solid #ffffff15', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>VALHALLA</h1>
          <span style={{ color: '#666', fontSize: 13 }}>Proof of Concept</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: nodes.length > 0 ? '#2ecc71' : '#e74c3c', fontSize: 13 }}>
            {nodes.length > 0 ? `${nodes.length} nodes online` : 'Disconnected'}
          </span>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ display: 'flex', borderBottom: '1px solid #ffffff15', paddingLeft: 24 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #4a9eff' : '2px solid transparent',
              color: activeTab === tab.id ? '#fff' : '#666',
              padding: '12px 20px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel */}
        <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {activeTab === 'network' && <NetworkGraph />}
          {activeTab === 'stack' && <StackView activeLayer={lastLayerEvent?.layer} />}
          {activeTab === 'demos' && <DemoRunner />}
          {activeTab === 'trust' && <TrustGraph attestations={[]} />}
        </div>

        {/* Right Panel - Event Log */}
        <div style={{ width: 360, borderLeft: '1px solid #ffffff15', padding: 12 }}>
          <EventLog />
        </div>
      </div>
    </div>
  );
}

export default App;
