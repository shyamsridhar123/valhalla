import { useMemo } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useValhallaStore } from '../store/useValhallaStore';
import { layers as layerDefs, colors, fonts, layerColors, formatRelativeTime, getNodeNameByShortId } from '../theme';

// Detailed protocol info for each layer
const layerProtocols: Record<string, {
  protocols: string[];
  primitives: string[];
  description: string;
}> = {
  realm: {
    protocols: ['P2P-RPC', 'Pub/Sub', 'CRDT (LWW)'],
    primitives: ['Remote procedure calls', 'Topic-based messaging', 'State convergence'],
    description: 'Application-layer protocols enabling distributed computation. RPC provides request/response messaging, Pub/Sub enables one-to-many broadcasts, and CRDTs ensure eventual consistency across replicas without coordination.',
  },
  rune: {
    protocols: ['Trust Attestations', 'Capability Tokens', 'Web of Trust'],
    primitives: ['Signed claims', 'Confidence scoring', 'Transitive trust'],
    description: 'Decentralized trust layer replacing centralized certificate authorities. Nodes issue attestations about peers with confidence values (0-1), forming a web-of-trust graph that enables capability-based access control.',
  },
  saga: {
    protocols: ['Content Addressing (CID)', 'Intent Routing', 'Content Discovery'],
    primitives: ['SHA-256 hashing', 'Content publication', 'Content retrieval'],
    description: 'Content-addressed storage and intent-based routing. Content is identified by its cryptographic hash (CID) rather than location, enabling deduplication and integrity verification without trusting the source.',
  },
  veil: {
    protocols: ['Stream Encryption', 'Stream Multiplexing', 'Key Exchange'],
    primitives: ['AES-256-GCM', 'ECDH key agreement', 'Multiplexed streams'],
    description: 'Transport security providing end-to-end encryption and stream multiplexing. Every peer connection is encrypted with unique session keys derived via ECDH, with multiple logical streams over a single connection.',
  },
  yggdrasil: {
    protocols: ['DHT (Kademlia)', 'Identity Management', 'Peer Routing'],
    primitives: ['256-bit node IDs', 'XOR distance metric', 'Routing table'],
    description: 'Network identity and routing using a Kademlia-based DHT. Each node has a cryptographic 256-bit ID, enabling decentralized peer discovery and content routing without centralized coordination.',
  },
  bifrost: {
    protocols: ['Frame Codec', 'TCP Transport', 'Connection Management'],
    primitives: ['Length-prefixed frames', 'Peer connections', 'Mesh topology'],
    description: 'Low-level transport providing framed communication over TCP. Manages the physical mesh topology, peer connections, and the wire protocol for encoding/decoding messages.',
  },
};

const layerVariants = {
  idle: { scale: 1 },
  active: {
    scale: [1, 1.015, 1],
    transition: { duration: 0.8, repeat: Infinity, repeatType: 'reverse' as const },
  },
};

const expandVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: 'auto', opacity: 1 },
};

interface StackViewProps {
  activeLayer?: string;
}

export function StackView({ activeLayer }: StackViewProps) {
  const events = useValhallaStore((s) => s.events);
  const nodes = useValhallaStore((s) => s.nodes);
  const setFilter = useValhallaStore((s) => s.setEventLayerFilter);
  const currentFilter = useValhallaStore((s) => s.eventLayerFilter);
  const expandedLayer = useValhallaStore((s) => s.expandedLayer);
  const setExpandedLayer = useValhallaStore((s) => s.setExpandedLayer);

  const layerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const evt of events) {
      counts[evt.layer] = (counts[evt.layer] || 0) + 1;
    }
    return counts;
  }, [events]);

  // Recent events count (last 30s) per layer
  const recentLayerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const recentWindow = Date.now() - 30000;
    for (const evt of events) {
      if (evt.timestamp > recentWindow && evt.layer !== 'demo') {
        counts[evt.layer] = (counts[evt.layer] || 0) + 1;
      }
    }
    return counts;
  }, [events]);

  // Last 3 events per layer
  const recentEventsByLayer = useMemo(() => {
    const map: Record<string, typeof events> = {};
    for (const evt of events) {
      if (evt.layer !== 'demo') {
        if (!map[evt.layer]) map[evt.layer] = [];
        map[evt.layer].push(evt);
        if (map[evt.layer].length > 3) map[evt.layer].shift();
      }
    }
    return map;
  }, [events]);

  // Unique node participation per layer
  const layerNodes = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    const recentWindow = Date.now() - 60000;
    for (const evt of events) {
      if (evt.layer !== 'demo' && evt.timestamp > recentWindow) {
        if (!map[evt.layer]) map[evt.layer] = new Set();
        const shortId = evt.node_id?.slice(0, 12);
        if (shortId) map[evt.layer].add(shortId);
      }
    }
    return map;
  }, [events]);

  // Events/sec per layer (30s window)
  const layerRate = useMemo(() => {
    const rates: Record<string, number> = {};
    for (const [layer, count] of Object.entries(recentLayerCounts)) {
      rates[layer] = count / 30;
    }
    return rates;
  }, [recentLayerCounts]);

  // Total events across all layers
  const totalEvents = useMemo(() => {
    return Object.values(layerCounts).reduce((a, b) => a + b, 0);
  }, [layerCounts]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Stack Summary Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '8px 16px',
        background: colors.surface2,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: colors.textSecondary }}>Valhalla Stack</span>
        <span style={{ fontSize: 11, color: colors.textDim }}>6-Layer Architecture</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: colors.accentBlue, fontFamily: fonts.mono }}>{totalEvents}</span>
          <span style={{ fontSize: 10, color: colors.textDim }}>total events</span>
        </div>
        {/* Layer distribution mini-bar */}
        <div style={{ display: 'flex', height: 6, width: 120, borderRadius: 3, overflow: 'hidden', background: colors.borderSubtle }}>
          {layerDefs.map((layer) => {
            const count = layerCounts[layer.key] || 0;
            const pct = totalEvents > 0 ? (count / totalEvents) * 100 : 0;
            return (
              <div
                key={layer.key}
                title={`${layer.name}: ${count} (${pct.toFixed(0)}%)`}
                style={{
                  width: `${pct}%`,
                  background: layer.color,
                  transition: 'width 0.3s ease',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Stack Layers */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Left: Interactive Stack */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {layerDefs.map((layer, i) => {
              const isActive = activeLayer?.toLowerCase() === layer.name.toLowerCase();
              const isFiltered = currentFilter === layer.key;
              const isExpanded = expandedLayer === layer.key;
              const count = layerCounts[layer.key] || 0;
              const recentCount = recentLayerCounts[layer.key] || 0;
              const recentEvents = recentEventsByLayer[layer.key] || [];
              const nodeCount = layerNodes[layer.key]?.size || 0;
              const rate = layerRate[layer.key] || 0;
              const proto = layerProtocols[layer.key];

              return (
                <div key={layer.name}>
                  <m.div
                    variants={layerVariants}
                    animate={isActive ? 'active' : 'idle'}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => setExpandedLayer(isExpanded ? null : layer.key)}
                    style={{
                      background: isActive ? layer.color : `${layer.color}10`,
                      border: `2px solid ${isFiltered ? colors.textPrimary : isExpanded ? layer.color : `${layer.color}40`}`,
                      borderRadius: isExpanded ? '8px 8px 0 0' : 8,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      transition: 'background 0.3s ease, border-color 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Layer color dot */}
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: layer.color,
                          boxShadow: isActive ? `0 0 8px ${layer.color}60` : 'none',
                          flexShrink: 0,
                        }} />
                        <div>
                          <span style={{ fontWeight: 700, color: colors.textPrimary, fontSize: 15 }}>
                            {layer.name}
                          </span>
                          <span style={{ color: isActive ? 'rgba(255,255,255,0.8)' : colors.textMuted, marginLeft: 10, fontSize: 12 }}>
                            {layer.desc}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Rate indicator */}
                        {rate > 0 && (
                          <span style={{
                            fontSize: 10, color: layer.color, fontFamily: fonts.mono,
                            fontWeight: 600,
                          }}>
                            {rate.toFixed(1)}/s
                          </span>
                        )}
                        {/* Node participation count */}
                        {nodeCount > 0 && (
                          <span style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 4,
                            background: `${layer.color}15`,
                            color: colors.textMuted,
                          }}>
                            {nodeCount} nodes
                          </span>
                        )}
                        {/* Event count badge */}
                        {count > 0 && (
                          <span style={{
                            background: `${layer.color}25`,
                            color: layer.color,
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 10,
                            minWidth: 28,
                            textAlign: 'center',
                            fontFamily: fonts.mono,
                          }}>
                            {count}
                          </span>
                        )}
                        {/* Expand indicator */}
                        <span style={{
                          color: colors.textDim, fontSize: 12,
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                          display: 'inline-block',
                        }}>
                          v
                        </span>
                      </div>
                    </div>
                  </m.div>

                  {/* Expanded Layer Detail */}
                  <AnimatePresence>
                    {isExpanded && proto && (
                      <m.div
                        variants={expandVariants}
                        initial="collapsed"
                        animate="expanded"
                        exit="collapsed"
                        transition={{ duration: 0.2 }}
                        style={{
                          overflow: 'hidden',
                          background: colors.surface2,
                          border: `2px solid ${layer.color}40`,
                          borderTop: 'none',
                          borderRadius: '0 0 8px 8px',
                        }}
                      >
                        <div style={{ padding: '12px 14px' }}>
                          {/* Description */}
                          <p style={{
                            fontSize: 12, color: colors.textSecondary,
                            lineHeight: 1.5, margin: '0 0 12px 0',
                          }}>
                            {proto.description}
                          </p>

                          {/* Protocols & Primitives side by side */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div>
                              <div style={{ fontSize: 9, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Protocols</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {proto.protocols.map((p) => (
                                  <span key={p} style={{
                                    fontSize: 11, fontFamily: fonts.mono,
                                    color: layer.color,
                                    background: `${layer.color}10`,
                                    padding: '3px 8px', borderRadius: 4,
                                    border: `1px solid ${layer.color}25`,
                                  }}>
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Primitives</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {proto.primitives.map((p) => (
                                  <span key={p} style={{
                                    fontSize: 11, color: colors.textMuted,
                                    padding: '3px 8px', borderRadius: 4,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${colors.borderSubtle}`,
                                  }}>
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Live Stats */}
                          <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
                            marginBottom: 12,
                          }}>
                            <StatBlock label="Total Events" value={count} color={layer.color} />
                            <StatBlock label="Recent (30s)" value={recentCount} color={layer.color} />
                            <StatBlock label="Rate" value={`${rate.toFixed(1)}/s`} color={layer.color} />
                          </div>

                          {/* Recent Events */}
                          {recentEvents.length > 0 && (
                            <div>
                              <div style={{ fontSize: 9, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Recent Events</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {recentEvents.map((evt, i) => (
                                  <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '4px 8px', borderRadius: 4,
                                    background: `${layer.color}08`,
                                    fontSize: 11, fontFamily: fonts.mono,
                                  }}>
                                    <span style={{ color: colors.textDim, fontSize: 9, minWidth: 24 }}>
                                      {formatRelativeTime(evt.timestamp)}
                                    </span>
                                    <span style={{ color: layer.color, fontWeight: 600 }}>{evt.type}</span>
                                    {evt.node_id && (
                                      <span style={{ color: colors.textMuted, marginLeft: 'auto', fontSize: 10 }}>
                                        {getNodeNameByShortId(evt.node_id.slice(0, 12), nodes)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Filter button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilter(isFiltered ? null : layer.key);
                            }}
                            style={{
                              marginTop: 10,
                              width: '100%',
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: `1px solid ${isFiltered ? layer.color : colors.borderDefault}`,
                              background: isFiltered ? `${layer.color}15` : 'transparent',
                              color: isFiltered ? layer.color : colors.textMuted,
                              cursor: 'pointer',
                              fontSize: 11,
                              fontWeight: 600,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isFiltered ? 'Clear event filter' : 'Filter events to this layer'}
                          </button>
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Right: Layer Inspector (replaces static OSI mapping) */}
          <div style={{ width: 280, flexShrink: 0 }}>
            <div style={{
              background: colors.surface2,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: 8,
              padding: 14,
              position: 'sticky',
              top: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, marginBottom: 12 }}>
                Layer Inspector
              </div>

              {/* Data flow visualization */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Data Flow (Top to Bottom)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                  {layerDefs.map((layer, i) => {
                    const isLayerActive = (recentLayerCounts[layer.key] || 0) > 0;
                    return (
                      <div key={layer.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                        {/* Layer bar */}
                        <m.div
                          animate={isLayerActive ? { boxShadow: `0 0 8px ${layer.color}30` } : { boxShadow: 'none' }}
                          transition={{ duration: 0.3 }}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: 4,
                            background: isLayerActive ? `${layer.color}15` : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isLayerActive ? `${layer.color}40` : colors.borderSubtle}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.3s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: isLayerActive ? layer.color : colors.textFaint,
                            }} />
                            <span style={{
                              fontSize: 11, fontWeight: 600,
                              color: isLayerActive ? layer.color : colors.textDim,
                            }}>
                              {layer.name}
                            </span>
                          </div>
                          <span style={{
                            fontSize: 9, color: colors.textDim,
                            fontFamily: fonts.mono,
                          }}>
                            {layer.osi}
                          </span>
                        </m.div>
                        {/* Connector arrow between layers */}
                        {i < layerDefs.length - 1 && (
                          <div style={{
                            width: 1, height: 8,
                            background: isLayerActive && (recentLayerCounts[layerDefs[i + 1].key] || 0) > 0
                              ? `linear-gradient(180deg, ${layer.color}60, ${layerDefs[i + 1].color}60)`
                              : colors.borderSubtle,
                            transition: 'background 0.3s ease',
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active layer detail */}
              {expandedLayer && layerProtocols[expandedLayer] && (
                <div style={{
                  padding: 10, borderRadius: 6,
                  background: `${layerColors[expandedLayer]}08`,
                  border: `1px solid ${layerColors[expandedLayer]}25`,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: layerColors[expandedLayer], marginBottom: 4 }}>
                    {layerDefs.find(l => l.key === expandedLayer)?.name} Details
                  </div>
                  <div style={{ fontSize: 10, color: colors.textMuted, lineHeight: 1.5 }}>
                    {layerProtocols[expandedLayer].description.slice(0, 120)}...
                  </div>
                </div>
              )}

              {/* Network mapping legend */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 9, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Stack vs OSI Model
                </div>
                <div style={{ fontSize: 10, color: colors.textMuted, lineHeight: 1.6 }}>
                  The Valhalla stack maps to OSI layers L2-L7, replacing traditional protocols with decentralized, identity-first equivalents.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${colors.borderSubtle}`,
      borderRadius: 6,
      padding: '6px 8px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: fonts.mono }}>{value}</div>
      <div style={{ fontSize: 8, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
}
