import { useState, useEffect, useMemo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { useValhalla } from '../hooks/useValhalla';
import { useValhallaStore } from '../store/useValhallaStore';
import { colors, fonts, layerColors, getNodeName } from '../theme';
import type { FullNodeState } from '../types/api';

type InspectorTab = 'peers' | 'services' | 'trust' | 'crdt' | 'events';

const TABS: { key: InspectorTab; label: string }[] = [
  { key: 'peers', label: 'Peers' },
  { key: 'services', label: 'Services' },
  { key: 'trust', label: 'Trust' },
  { key: 'crdt', label: 'CRDT' },
  { key: 'events', label: 'Events' },
];

interface Props {
  nodeIndex: number;
  shortId: string;
  onClose: () => void;
}

export function NodeInspector({ nodeIndex, shortId, onClose }: Props) {
  const [state, setState] = useState<FullNodeState | null>(null);
  const [activeTab, setActiveTab] = useState<InspectorTab>('peers');
  const { fetchNodeState } = useValhalla();
  const events = useValhallaStore(s => s.events);

  // Poll node state
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const data = await fetchNodeState(nodeIndex);
      if (mounted && data) setState(data);
    };
    load();
    const interval = setInterval(load, 2000);
    return () => { mounted = false; clearInterval(interval); };
  }, [nodeIndex, fetchNodeState]);

  // Filter events for this node
  const nodeEvents = useMemo(() =>
    events.filter(e => e.node_id?.slice(0, 12) === shortId && e.layer !== 'demo').slice(-30),
    [events, shortId]
  );

  const nodeName = getNodeName(nodeIndex);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${colors.borderSubtle}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: layerColors.yggdrasil,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: '#fff',
        }}>
          {nodeName[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{nodeName}</div>
          <div style={{ fontSize: 10, color: colors.textDim, fontFamily: fonts.mono }}>{shortId}</div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: colors.textDim,
          cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4,
        }}>x</button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${colors.borderSubtle}`,
        flexShrink: 0,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: 10,
              fontWeight: 600,
              color: activeTab === tab.key ? colors.accentBlue : colors.textDim,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? `2px solid ${colors.accentBlue}` : '2px solid transparent',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {!state ? (
          <div style={{ color: colors.textDim, fontSize: 12, textAlign: 'center', padding: 20 }}>Loading...</div>
        ) : (
          <AnimatePresence mode="wait">
            <m.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              {activeTab === 'peers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                    {state.peers.length} connected peer{state.peers.length !== 1 ? 's' : ''}
                  </div>
                  {state.peers.map(p => (
                    <div key={p.node_id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', background: colors.surface1,
                      borderRadius: 6, border: `1px solid ${colors.borderSubtle}`,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors.online }} />
                      <span style={{ fontSize: 12, color: '#fff', fontFamily: fonts.mono }}>{p.short_id}</span>
                    </div>
                  ))}
                  {state.peers.length === 0 && (
                    <div style={{ fontSize: 12, color: colors.textDim, fontStyle: 'italic' }}>No peers connected</div>
                  )}
                </div>
              )}

              {activeTab === 'services' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                    {state.services.length} registered service{state.services.length !== 1 ? 's' : ''}
                  </div>
                  {state.services.map(s => (
                    <div key={s} style={{
                      padding: '6px 8px', background: colors.surface1,
                      borderRadius: 6, border: `1px solid ${colors.borderSubtle}`,
                      fontSize: 12, color: layerColors.saga, fontFamily: fonts.mono,
                    }}>
                      {s}
                    </div>
                  ))}
                  {state.services.length === 0 && (
                    <div style={{ fontSize: 12, color: colors.textDim, fontStyle: 'italic' }}>No services registered</div>
                  )}
                </div>
              )}

              {activeTab === 'trust' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                    Outgoing attestations
                  </div>
                  {state.trust_out && state.trust_out.length > 0 ? state.trust_out.map((t, i) => (
                    <div key={i} style={{
                      padding: '8px', background: colors.surface1,
                      borderRadius: 6, border: `1px solid ${colors.borderSubtle}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#fff', fontFamily: fonts.mono }}>{t.subject}</span>
                        <span style={{ fontSize: 11, color: layerColors.rune, fontWeight: 600 }}>
                          {(t.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div style={{
                        marginTop: 4, height: 3, borderRadius: 2, background: colors.surface2,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${t.confidence * 100}%`, height: '100%',
                          background: layerColors.rune, borderRadius: 2,
                        }} />
                      </div>
                      <div style={{ fontSize: 10, color: colors.textDim, marginTop: 4 }}>{t.claim}</div>
                    </div>
                  )) : (
                    <div style={{ fontSize: 12, color: colors.textDim, fontStyle: 'italic' }}>No attestations</div>
                  )}
                </div>
              )}

              {activeTab === 'crdt' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                    CRDT State (LWW Registers)
                  </div>
                  {state.crdt_state && Object.keys(state.crdt_state).length > 0 ? (
                    Object.entries(state.crdt_state).map(([k, v]) => (
                      <div key={k} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '6px 8px', background: colors.surface1,
                        borderRadius: 6, border: `1px solid ${colors.borderSubtle}`,
                        fontFamily: fonts.mono, fontSize: 12,
                      }}>
                        <span style={{ color: layerColors.realm }}>{k}</span>
                        <span style={{ color: '#fff' }}>{v}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: colors.textDim, fontStyle: 'italic' }}>No CRDT state</div>
                  )}
                </div>
              )}

              {activeTab === 'events' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                    Recent events ({nodeEvents.length})
                  </div>
                  {nodeEvents.length > 0 ? nodeEvents.slice().reverse().map((evt, i) => (
                    <div key={i} style={{
                      padding: '4px 8px', background: colors.surface1,
                      borderRadius: 4, border: `1px solid ${colors.borderSubtle}`,
                      fontSize: 11, fontFamily: fonts.mono,
                    }}>
                      <span style={{ color: layerColors[evt.layer] || colors.textDim }}>{evt.layer}</span>
                      <span style={{ color: colors.textMuted }}>/</span>
                      <span style={{ color: colors.textSecondary }}>{evt.type}</span>
                    </div>
                  )) : (
                    <div style={{ fontSize: 12, color: colors.textDim, fontStyle: 'italic' }}>No events yet</div>
                  )}
                </div>
              )}
            </m.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
