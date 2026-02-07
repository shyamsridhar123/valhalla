import { useValhallaStore } from '../store/useValhallaStore';
import { useValhalla } from '../hooks/useValhalla';
import { motion } from 'framer-motion';

export function DemoRunner() {
  const scenarios = useValhallaStore((s) => s.scenarios);
  const runningScenario = useValhallaStore((s) => s.runningScenario);
  const setRunningScenario = useValhallaStore((s) => s.setRunningScenario);
  const events = useValhallaStore((s) => s.events);
  const { runScenario } = useValhalla();

  const narrations = events
    .filter((e) => e.layer === 'demo' && e.type === 'narration')
    .slice(-20);

  const handleRun = async (name: string) => {
    setRunningScenario(name);
    await runScenario(name);
    // Scenario runs async, narrations arrive via WebSocket
    setTimeout(() => setRunningScenario(null), 15000);
  };

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ color: '#ccc', marginBottom: 16 }}>Demo Scenarios</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
        {scenarios.map((sc) => (
          <motion.button
            key={sc.name}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleRun(sc.name)}
            disabled={runningScenario !== null}
            style={{
              background: runningScenario === sc.name ? '#4a9eff' : '#1a1a2e',
              border: '1px solid #4a9eff',
              borderRadius: 8,
              padding: '16px',
              cursor: runningScenario ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              color: '#fff',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{sc.name}</div>
            <div style={{ color: '#999', fontSize: 13 }}>{sc.description}</div>
            {runningScenario === sc.name && (
              <div style={{ color: '#4a9eff', fontSize: 12, marginTop: 8 }}>
                Running...
              </div>
            )}
          </motion.button>
        ))}
      </div>

      {scenarios.length === 0 && (
        <div style={{ color: '#666', textAlign: 'center', padding: 32 }}>
          No scenarios available. Start the daemon with --demo flag.
        </div>
      )}

      <h3 style={{ color: '#ccc', marginBottom: 12 }}>Narration</h3>
      <div
        style={{
          background: '#0d0d1a',
          border: '1px solid #ffffff15',
          borderRadius: 8,
          padding: 16,
          maxHeight: 300,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: 13,
        }}
      >
        {narrations.length === 0 ? (
          <span style={{ color: '#555' }}>Run a scenario to see narration...</span>
        ) : (
          narrations.map((evt, i) => (
            <div key={i} style={{ color: '#ccc', marginBottom: 4 }}>
              <span style={{ color: '#4a9eff' }}>[{evt.data?.scenario}]</span>{' '}
              {evt.data?.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
