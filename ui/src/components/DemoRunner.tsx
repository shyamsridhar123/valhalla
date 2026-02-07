import { useEffect, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useValhallaStore } from '../store/useValhallaStore';
import { useValhalla } from '../hooks/useValhalla';
import { colors, fonts } from '../theme';
import { SCENARIO_META, SCENARIO_ORDER, getLayerColor } from './scenarioMeta';
import { ScenarioCard } from './ScenarioCard';
import { ScenarioViz } from './ScenarioViz';
import { NarrationTimeline } from './NarrationTimeline';
import { LayerActivityBar } from './LayerActivityBar';

export function DemoRunner() {
  const scenarios = useValhallaStore((s) => s.scenarios);
  const runningScenario = useValhallaStore((s) => s.runningScenario);
  const setRunningScenario = useValhallaStore((s) => s.setRunningScenario);
  const events = useValhallaStore((s) => s.events);
  const scenarioPhase = useValhallaStore((s) => s.scenarioPhase);
  const setScenarioPhase = useValhallaStore((s) => s.setScenarioPhase);
  const scenarioLayerActivity = useValhallaStore(
    (s) => s.scenarioLayerActivity
  );
  const setScenarioLayerActivity = useValhallaStore(
    (s) => s.setScenarioLayerActivity
  );
  const guidedTourActive = useValhallaStore((s) => s.guidedTourActive);
  const setGuidedTourActive = useValhallaStore((s) => s.setGuidedTourActive);
  const guidedTourIndex = useValhallaStore((s) => s.guidedTourIndex);
  const setGuidedTourIndex = useValhallaStore((s) => s.setGuidedTourIndex);
  const resetScenarioState = useValhallaStore((s) => s.resetScenarioState);

  const { runScenario } = useValhalla();
  const tourTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Extract narrations for current scenario
  const narrations = useMemo(
    () =>
      events.filter(
        (e) =>
          e.layer === 'demo' &&
          e.type === 'narration' &&
          e.data?.scenario === runningScenario
      ),
    [events, runningScenario]
  );

  // Detect scenario completion
  const isComplete = useMemo(() => {
    if (!runningScenario || narrations.length === 0) return false;
    const lastMsg = narrations[narrations.length - 1]?.data?.message || '';
    const lower = lastMsg.toLowerCase();
    return lower.includes('complete') || lower.includes('error');
  }, [narrations, runningScenario]);

  // Update layer activity based on recent events
  useEffect(() => {
    if (scenarioPhase !== 'playing' && scenarioPhase !== 'complete') return;
    const activity: Record<string, boolean> = {};
    // Infer from narration text
    const lastFew = narrations.slice(-5);
    for (const n of lastFew) {
      const msg = (n.data?.message || '').toLowerCase();
      if (msg.includes('encrypt') || msg.includes('ciphertext'))
        activity['veil'] = true;
      if (msg.includes('attest') || msg.includes('trust'))
        activity['rune'] = true;
      if (
        msg.includes('content') ||
        msg.includes('cid') ||
        msg.includes('service') ||
        msg.includes('discover')
      )
        activity['saga'] = true;
      if (
        msg.includes('node') &&
        (msg.includes('join') || msg.includes('routing'))
      )
        activity['yggdrasil'] = true;
      if (
        msg.includes('chat') ||
        msg.includes('rpc') ||
        msg.includes('crdt') ||
        msg.includes('delivered')
      )
        activity['realm'] = true;
      if (msg.includes('mesh') || msg.includes('peer'))
        activity['bifrost'] = true;
    }
    setScenarioLayerActivity(activity);
  }, [narrations, scenarioPhase, setScenarioLayerActivity]);

  // Handle completion transitions
  useEffect(() => {
    if (!isComplete) return;
    setScenarioPhase('complete');

    if (guidedTourActive) {
      const nextIndex = guidedTourIndex + 1;
      if (nextIndex < SCENARIO_ORDER.length) {
        tourTimerRef.current = setTimeout(() => {
          setGuidedTourIndex(nextIndex);
          launchScenario(SCENARIO_ORDER[nextIndex]);
        }, 2500);
      } else {
        tourTimerRef.current = setTimeout(() => {
          setGuidedTourActive(false);
        }, 2000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // Safety timeout
  useEffect(() => {
    if (!runningScenario || scenarioPhase !== 'playing') return;
    const timer = setTimeout(() => {
      setScenarioPhase('complete');
    }, 30000);
    return () => clearTimeout(timer);
  }, [runningScenario, scenarioPhase, setScenarioPhase]);

  // Cleanup tour timer on unmount
  useEffect(() => {
    return () => clearTimeout(tourTimerRef.current);
  }, []);

  const launchScenario = useCallback(
    async (name: string) => {
      setRunningScenario(name);
      setScenarioPhase('playing');
      setScenarioLayerActivity({});
      await runScenario(name);
    },
    [
      runScenario,
      setRunningScenario,
      setScenarioPhase,
      setScenarioLayerActivity,
    ]
  );

  const handleBack = useCallback(() => {
    clearTimeout(tourTimerRef.current);
    resetScenarioState();
  }, [resetScenarioState]);

  const handleStartTour = useCallback(() => {
    setGuidedTourActive(true);
    setGuidedTourIndex(0);
    launchScenario(SCENARIO_ORDER[0]);
  }, [setGuidedTourActive, setGuidedTourIndex, launchScenario]);

  const handleCancelTour = useCallback(() => {
    clearTimeout(tourTimerRef.current);
    setGuidedTourActive(false);
  }, [setGuidedTourActive]);

  const meta = runningScenario ? SCENARIO_META[runningScenario] : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Tour progress bar */}
      {guidedTourActive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderBottom: `1px solid ${colors.borderSubtle}`,
            background: 'rgba(74,158,255,0.04)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: colors.accentBlue,
              textTransform: 'uppercase',
              letterSpacing: 1,
              flexShrink: 0,
            }}
          >
            Guided Tour
          </span>
          <div
            style={{
              flex: 1,
              display: 'flex',
              gap: 4,
              alignItems: 'center',
            }}
          >
            {SCENARIO_ORDER.map((id, i) => {
              const sMeta = SCENARIO_META[id];
              const isDone = i < guidedTourIndex;
              const isCurrent = i === guidedTourIndex;
              return (
                <div
                  key={id}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: isDone
                      ? colors.accentGreen
                      : isCurrent
                        ? sMeta.gradient[0]
                        : colors.borderStrong,
                    transition: 'background 0.3s',
                  }}
                />
              );
            })}
          </div>
          <span
            style={{
              fontSize: 10,
              color: colors.textDim,
              fontFamily: fonts.mono,
              flexShrink: 0,
            }}
          >
            {guidedTourIndex + 1}/{SCENARIO_ORDER.length}
          </span>
          <button
            onClick={handleCancelTour}
            style={{
              background: 'none',
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: 4,
              color: colors.textDim,
              fontSize: 10,
              padding: '2px 8px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Stop
          </button>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          {scenarioPhase === 'selecting' ? (
            <m.div
              key="selecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              style={{
                height: '100%',
                overflow: 'auto',
                padding: '24px 20px',
              }}
            >
              {/* Header */}
              <div
                style={{
                  marginBottom: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#fff',
                      letterSpacing: 0.5,
                    }}
                  >
                    Scenario Theater
                  </h3>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 13,
                      color: colors.textDim,
                    }}
                  >
                    Experience the Valhalla stack in action
                  </p>
                </div>
                <m.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleStartTour}
                  disabled={scenarios.length === 0}
                  style={{
                    background:
                      'linear-gradient(135deg, #4a9eff, #7b68ee)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 20px',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor:
                      scenarios.length === 0
                        ? 'not-allowed'
                        : 'pointer',
                    letterSpacing: 0.3,
                    opacity: scenarios.length === 0 ? 0.5 : 1,
                  }}
                >
                  Start Guided Tour
                </m.button>
              </div>

              {/* Scenario cards grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 16,
                }}
              >
                {scenarios.map((sc) => {
                  const sMeta = SCENARIO_META[sc.name];
                  if (!sMeta) return null;
                  return (
                    <ScenarioCard
                      key={sc.name}
                      meta={sMeta}
                      description={sc.description}
                      isDisabled={false}
                      onSelect={() => launchScenario(sc.name)}
                    />
                  );
                })}
              </div>

              {scenarios.length === 0 && (
                <div
                  style={{
                    color: colors.textDim,
                    textAlign: 'center',
                    padding: 48,
                    fontSize: 14,
                  }}
                >
                  No scenarios available. Start the daemon with{' '}
                  <code
                    style={{
                      background: colors.surface2,
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    --demo
                  </code>{' '}
                  flag.
                </div>
              )}
            </m.div>
          ) : (
            <m.div
              key="playing"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Playback header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  borderBottom: `1px solid ${colors.borderSubtle}`,
                  flexShrink: 0,
                }}
              >
                <m.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBack}
                  style={{
                    background: 'none',
                    border: `1px solid ${colors.borderStrong}`,
                    borderRadius: 6,
                    padding: '4px 12px',
                    color: colors.textDim,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 14 }}>&larr;</span> Back
                </m.button>

                {meta && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 4 }}>
                      {meta.layers.map((layer) => (
                        <div
                          key={layer}
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: getLayerColor(layer),
                            boxShadow: scenarioLayerActivity[layer]
                              ? `0 0 8px ${getLayerColor(layer)}60`
                              : 'none',
                          }}
                        />
                      ))}
                    </div>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: '#fff',
                      }}
                    >
                      {meta.title}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: meta.gradient[0],
                        fontWeight: 600,
                      }}
                    >
                      {meta.subtitle}
                    </span>
                  </div>
                )}

                <div style={{ marginLeft: 'auto' }}>
                  {scenarioPhase === 'playing' && (
                    <m.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{
                        fontSize: 11,
                        color: colors.accentBlue,
                        fontWeight: 600,
                      }}
                    >
                      Running
                    </m.span>
                  )}
                  {scenarioPhase === 'complete' && (
                    <span
                      style={{
                        fontSize: 11,
                        color: colors.accentGreen,
                        fontWeight: 600,
                      }}
                    >
                      Complete
                    </span>
                  )}
                </div>
              </div>

              {/* Split view: visualization + timeline */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  overflow: 'hidden',
                }}
              >
                {/* Visualization panel */}
                <div
                  style={{
                    flex: '1 1 65%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: colors.surface1,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {runningScenario && (
                    <ScenarioViz
                      scenario={runningScenario}
                      narrations={narrations}
                      isComplete={isComplete}
                    />
                  )}
                </div>

                {/* Timeline panel */}
                <div
                  style={{
                    flex: '0 0 35%',
                    maxWidth: 360,
                    borderLeft: `1px solid ${colors.borderSubtle}`,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    background: colors.surface0,
                  }}
                >
                  <NarrationTimeline
                    narrations={narrations}
                    isComplete={isComplete}
                  />
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* Layer activity bar */}
      <LayerActivityBar activity={scenarioLayerActivity} />
    </div>
  );
}
