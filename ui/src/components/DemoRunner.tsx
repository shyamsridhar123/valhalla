import { useEffect } from 'react';
import { m } from 'framer-motion';
import { useValhallaStore } from '../store/useValhallaStore';
import { useValhalla } from '../hooks/useValhalla';
import { colors, formatRelativeTime } from '../theme';

const pulseVariants = {
  idle: {},
  running: {
    boxShadow: [
      '0 0 0 0 rgba(74, 158, 255, 0.4)',
      '0 0 0 8px rgba(74, 158, 255, 0)',
      '0 0 0 0 rgba(74, 158, 255, 0)',
    ],
    transition: { duration: 1.5, repeat: Infinity },
  },
};

export function DemoRunner() {
  const scenarios = useValhallaStore((s) => s.scenarios);
  const runningScenario = useValhallaStore((s) => s.runningScenario);
  const setRunningScenario = useValhallaStore((s) => s.setRunningScenario);
  const events = useValhallaStore((s) => s.events);
  const { runScenario } = useValhalla();

  const narrations = events
    .filter((e) => e.layer === 'demo' && e.type === 'narration')
    .slice(-20);

  // Event-driven scenario completion
  useEffect(() => {
    if (!runningScenario) return;
    const lastNarration = events
      .filter((e) => e.layer === 'demo' && e.type === 'narration' && e.data?.scenario === runningScenario)
      .at(-1);
    if (
      lastNarration?.data?.message?.toLowerCase().includes('complete') ||
      lastNarration?.data?.message?.toLowerCase().includes('error')
    ) {
      setRunningScenario(null);
    }
  }, [events, runningScenario, setRunningScenario]);

  // Safety timeout (30s)
  useEffect(() => {
    if (!runningScenario) return;
    const timer = setTimeout(() => setRunningScenario(null), 30000);
    return () => clearTimeout(timer);
  }, [runningScenario, setRunningScenario]);

  const handleRun = async (name: string) => {
    setRunningScenario(name);
    await runScenario(name);
  };

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ color: colors.textSecondary, marginBottom: 16 }}>Demo Scenarios</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
        {scenarios.map((sc) => {
          const isRunning = runningScenario === sc.name;
          return (
            <m.button
              key={sc.name}
              variants={pulseVariants}
              animate={isRunning ? 'running' : 'idle'}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleRun(sc.name)}
              disabled={runningScenario !== null}
              style={{
                background: isRunning ? colors.accentBlue : colors.surface1,
                border: `1px solid ${isRunning ? colors.accentBlue : colors.borderStrong}`,
                borderRadius: 8,
                padding: '16px',
                cursor: runningScenario ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                color: '#fff',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{sc.name}</div>
              <div style={{ color: isRunning ? 'rgba(255,255,255,0.8)' : colors.textMuted, fontSize: 13 }}>{sc.description}</div>
              {isRunning && (
                <div style={{ color: '#fff', fontSize: 12, marginTop: 8, fontWeight: 600 }}>
                  Running...
                </div>
              )}
            </m.button>
          );
        })}
      </div>

      {scenarios.length === 0 && (
        <div style={{ color: colors.textDim, textAlign: 'center', padding: 32 }}>
          No scenarios available. Start the daemon with --demo flag.
        </div>
      )}

      <h3 style={{ color: colors.textSecondary, marginBottom: 12 }}>Narration</h3>
      <div
        style={{
          background: colors.surface2,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: 8,
          padding: 16,
          maxHeight: 300,
          overflowY: 'auto',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
        }}
      >
        {narrations.length === 0 ? (
          <span style={{ color: colors.textFaint }}>Run a scenario to see narration...</span>
        ) : (
          narrations.map((evt, i) => (
            <div key={i} style={{ color: colors.textSecondary, marginBottom: 4, display: 'flex', gap: 8 }}>
              <span style={{ color: colors.textDim, fontSize: 10, minWidth: 24, flexShrink: 0 }}>
                {formatRelativeTime(evt.timestamp)}
              </span>
              <span>
                <span style={{ color: colors.accentBlue, fontWeight: 600 }}>[{evt.data?.scenario}]</span>{' '}
                {evt.data?.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
