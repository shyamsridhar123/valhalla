import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { AnimatePresence, m } from 'framer-motion';
import { useValhallaStore } from '../store/useValhallaStore';
import { colors, getNodeName, getNodeNameByShortId, layerColors, fonts, formatRelativeTime, layers as layerDefs } from '../theme';
import { appendGlowFilter, appendArrowMarker, createDragBehavior, getContainerDimensions } from '../utils/d3-helpers';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  nodeIndex: number;
  address: string;
  port: number;
  peerCount: number;
  services: string[];
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

const detailVariants = {
  hidden: { opacity: 0, x: 20, scale: 0.95 },
  visible: { opacity: 1, x: 0, scale: 1 },
};

const statsBarVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
};

export function NetworkGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodes = useValhallaStore((s) => s.nodes);
  const peers = useValhallaStore((s) => s.peers);
  const events = useValhallaStore((s) => s.events);
  const selectedNode = useValhallaStore((s) => s.selectedNode);
  const setSelectedNode = useValhallaStore((s) => s.setSelectedNode);
  const [hoveredLink, setHoveredLink] = useState<{ from: string; to: string; x: number; y: number } | null>(null);

  // Compute network statistics
  const networkStats = useMemo(() => {
    const recentWindow = Date.now() - 30000; // last 30s
    const recentEvents = events.filter(e => e.timestamp > recentWindow && e.layer !== 'demo');
    const layerBreakdown: Record<string, number> = {};
    for (const evt of recentEvents) {
      layerBreakdown[evt.layer] = (layerBreakdown[evt.layer] || 0) + 1;
    }
    const activeLayers = Object.keys(layerBreakdown).length;
    const msgPerSec = recentEvents.length / 30;

    // Unique connections
    const linkSet = new Set<string>();
    for (const p of peers) {
      linkSet.add([p.from, p.to].sort().join('-'));
    }

    return {
      nodeCount: nodes.length,
      linkCount: linkSet.size,
      eventsPerSec: msgPerSec,
      activeLayers,
      layerBreakdown,
      recentEventCount: recentEvents.length,
    };
  }, [nodes, peers, events]);

  // Per-link traffic intensity (how many events mention both endpoints)
  const linkTraffic = useMemo(() => {
    const map = new Map<string, { count: number; lastLayer: string }>();
    const recentWindow = Date.now() - 15000;
    const recent = events.filter(e => e.timestamp > recentWindow && e.layer !== 'demo');
    for (const evt of recent) {
      const fromId = evt.node_id?.slice(0, 12);
      const targetId = evt.data?.peer?.slice(0, 12) || evt.data?.target?.slice(0, 12) || evt.data?.from?.slice(0, 12);
      if (fromId && targetId) {
        const key = [fromId, targetId].sort().join('-');
        const existing = map.get(key);
        map.set(key, { count: (existing?.count || 0) + 1, lastLayer: evt.layer });
      }
    }
    return map;
  }, [events]);

  // Find most recent layer activity per node
  const nodeLayerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const evt of events) {
      if (evt.layer !== 'demo') {
        const shortId = evt.node_id?.slice(0, 12);
        if (shortId) map.set(shortId, evt.layer);
      }
    }
    return map;
  }, [events]);

  // Recent events per node (last 5)
  const nodeRecentEvents = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const evt of events) {
      if (evt.layer !== 'demo') {
        const shortId = evt.node_id?.slice(0, 12);
        if (shortId) {
          const list = map.get(shortId) || [];
          list.push(evt);
          if (list.length > 5) list.shift();
          map.set(shortId, list);
        }
      }
    }
    return map;
  }, [events]);

  // Per-node event count (for ring thickness)
  const nodeEventCounts = useMemo(() => {
    const map = new Map<string, number>();
    const recentWindow = Date.now() - 30000;
    for (const evt of events) {
      if (evt.layer !== 'demo' && evt.timestamp > recentWindow) {
        const shortId = evt.node_id?.slice(0, 12);
        if (shortId) map.set(shortId, (map.get(shortId) || 0) + 1);
      }
    }
    return map;
  }, [events]);

  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null;
    const idx = nodes.findIndex((n) => n.short_id === selectedNode);
    if (idx < 0) return null;
    const n = nodes[idx];
    return {
      ...n,
      name: getNodeName(idx),
      index: idx,
      layerColor: layerColors[nodeLayerMap.get(n.short_id) || 'yggdrasil'] || colors.accentBlue,
      recentEvents: nodeRecentEvents.get(n.short_id) || [],
      eventCount: nodeEventCounts.get(n.short_id) || 0,
    };
  }, [selectedNode, nodes, nodeLayerMap, nodeRecentEvents, nodeEventCounts]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = getContainerDimensions(svgRef.current);

    svg.selectAll('*').remove();

    if (nodes.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', colors.textDim)
        .attr('font-size', '14px')
        .text('Waiting for nodes... Start the daemon with --demo');
      return;
    }

    const graphNodes: GraphNode[] = nodes.map((n, i) => ({
      id: n.short_id,
      name: getNodeName(i),
      nodeIndex: i,
      address: n.address,
      port: n.port,
      peerCount: n.peer_count,
      services: n.services || [],
    }));

    const seen = new Set<string>();
    const graphLinks: GraphLink[] = [];
    for (const p of peers) {
      const key = [p.from, p.to].sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        graphLinks.push({ source: p.from, target: p.to });
      }
    }

    const simulation = d3
      .forceSimulation(graphNodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance(180)
      )
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(55))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    const defs = svg.append('defs');
    appendGlowFilter(defs, 'node-glow', 4);
    appendGlowFilter(defs, 'link-glow', 2);
    appendArrowMarker(defs, 'link-arrow', colors.accentBlue, 42);

    // Node gradients
    const gradientColors = [
      { id: 'grad-default', inner: '#38BDF8', outer: '#0EA5E9' },
      { id: 'grad-selected', inner: '#FACC15', outer: '#EAB308' },
    ];
    for (const gc of gradientColors) {
      const grad = defs.append('radialGradient').attr('id', gc.id);
      grad.append('stop').attr('offset', '0%').attr('stop-color', gc.inner).attr('stop-opacity', '0.9');
      grad.append('stop').attr('offset', '100%').attr('stop-color', gc.outer).attr('stop-opacity', '0.6');
    }

    // Layer-specific gradients for active links
    for (const [layerKey, layerColor] of Object.entries(layerColors)) {
      const grad = defs.append('radialGradient').attr('id', `grad-${layerKey}`);
      grad.append('stop').attr('offset', '0%').attr('stop-color', layerColor).attr('stop-opacity', '0.9');
      grad.append('stop').attr('offset', '100%').attr('stop-color', layerColor).attr('stop-opacity', '0.4');
    }

    const g = svg.append('g');

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        })
    );

    // Links - base connections
    const link = g
      .append('g')
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(graphLinks)
      .join('line')
      .attr('stroke', (d) => {
        const src = typeof d.source === 'string' ? d.source : d.source.id;
        const tgt = typeof d.target === 'string' ? d.target : d.target.id;
        const key = [src, tgt].sort().join('-');
        const traffic = linkTraffic.get(key);
        return traffic ? (layerColors[traffic.lastLayer] || colors.accentBlue) : colors.accentBlue;
      })
      .attr('stroke-opacity', (d) => {
        const src = typeof d.source === 'string' ? d.source : d.source.id;
        const tgt = typeof d.target === 'string' ? d.target : d.target.id;
        const key = [src, tgt].sort().join('-');
        return linkTraffic.has(key) ? 0.5 : 0.2;
      })
      .attr('stroke-width', (d) => {
        const src = typeof d.source === 'string' ? d.source : d.source.id;
        const tgt = typeof d.target === 'string' ? d.target : d.target.id;
        const key = [src, tgt].sort().join('-');
        const traffic = linkTraffic.get(key);
        return traffic ? Math.min(1.5 + traffic.count * 0.3, 4) : 1.5;
      })
      .attr('stroke-dasharray', '6,4')
      .attr('marker-end', 'url(#link-arrow)')
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        const src = d.source as GraphNode;
        const tgt = d.target as GraphNode;
        d3.select(this).attr('stroke-opacity', 0.8).attr('stroke-width', 3);
        const mx = (src.x! + tgt.x!) / 2;
        const my = (src.y! + tgt.y!) / 2;
        setHoveredLink({ from: src.id, to: tgt.id, x: event.pageX, y: event.pageY });
      })
      .on('mouseleave', function (_, d) {
        const src = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
        const tgt = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
        const key = [src, tgt].sort().join('-');
        const traffic = linkTraffic.get(key);
        d3.select(this)
          .attr('stroke-opacity', traffic ? 0.5 : 0.2)
          .attr('stroke-width', traffic ? Math.min(1.5 + traffic.count * 0.3, 4) : 1.5);
        setHoveredLink(null);
      });

    // Animated dash flow
    function animateDashes() {
      link
        .attr('stroke-dashoffset', 0)
        .transition()
        .duration(2000)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', -20)
        .on('end', animateDashes);
    }
    animateDashes();

    // Animated particles along active links
    const particleGroup = g.append('g').attr('class', 'particles');
    function spawnParticles() {
      graphLinks.forEach((d) => {
        const src = d.source as GraphNode;
        const tgt = d.target as GraphNode;
        if (!src.x || !tgt.x) return;
        const key = [src.id, tgt.id].sort().join('-');
        const traffic = linkTraffic.get(key);
        if (!traffic || traffic.count < 2) return;

        const particleColor = layerColors[traffic.lastLayer] || colors.accentBlue;
        const particle = particleGroup
          .append('circle')
          .attr('r', 2.5)
          .attr('fill', particleColor)
          .attr('opacity', 0.8)
          .attr('cx', src.x!)
          .attr('cy', src.y!);

        particle
          .transition()
          .duration(1200 + Math.random() * 800)
          .ease(d3.easeLinear)
          .attr('cx', tgt.x!)
          .attr('cy', tgt.y!)
          .attr('opacity', 0)
          .remove();
      });
    }
    const particleInterval = setInterval(spawnParticles, 1500);

    // Node groups
    const node = g
      .append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(graphNodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_, d) => {
        setSelectedNode(selectedNode === d.id ? null : d.id);
      })
      .call(createDragBehavior(simulation));

    // Activity ring (pulsing outer ring based on event count)
    node
      .append('circle')
      .attr('r', 36)
      .attr('fill', 'none')
      .attr('stroke', (d) => layerColors[nodeLayerMap.get(d.id) || 'yggdrasil'] || colors.accentBlue)
      .attr('stroke-width', (d) => {
        const count = nodeEventCounts.get(d.id) || 0;
        return count > 0 ? Math.min(1 + count * 0.15, 3) : 0;
      })
      .attr('stroke-dasharray', '3,2')
      .attr('opacity', 0.3);

    // Outer ring (layer color)
    node
      .append('circle')
      .attr('r', 32)
      .attr('fill', 'none')
      .attr('stroke', (d) => layerColors[nodeLayerMap.get(d.id) || 'yggdrasil'] || colors.accentBlue)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,3')
      .attr('opacity', 0.5);

    // Main circle
    node
      .append('circle')
      .attr('r', 26)
      .attr('fill', (d) => d.id === selectedNode ? 'url(#grad-selected)' : 'url(#grad-default)')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#node-glow)');

    // Status dot
    node
      .append('circle')
      .attr('cx', 18)
      .attr('cy', 18)
      .attr('r', 4)
      .attr('fill', colors.online)
      .attr('stroke', colors.surface1)
      .attr('stroke-width', 1.5);

    // Peer count badge
    node
      .append('circle')
      .attr('cx', -18)
      .attr('cy', -18)
      .attr('r', 8)
      .attr('fill', colors.surface1)
      .attr('stroke', colors.textDim)
      .attr('stroke-width', 1);

    node
      .append('text')
      .text((d) => String(d.peerCount))
      .attr('x', -18)
      .attr('y', -18)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', colors.textMuted)
      .attr('font-size', '8px')
      .attr('font-weight', '600')
      .attr('font-family', fonts.mono);

    // Name label
    node
      .append('text')
      .text((d) => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#fff')
      .attr('font-size', '12px')
      .attr('font-weight', '700')
      .attr('font-family', fonts.ui);

    // ID sublabel
    node
      .append('text')
      .text((d) => d.id.slice(0, 8))
      .attr('text-anchor', 'middle')
      .attr('dy', '3.2em')
      .attr('fill', colors.textDim)
      .attr('font-size', '9px')
      .attr('font-family', fonts.mono);

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x!)
        .attr('y1', (d) => (d.source as GraphNode).y!)
        .attr('x2', (d) => (d.target as GraphNode).x!)
        .attr('y2', (d) => (d.target as GraphNode).y!);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
      clearInterval(particleInterval);
    };
  }, [nodes, peers, selectedNode, setSelectedNode, nodeLayerMap, linkTraffic, nodeEventCounts]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 400, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* Network Stats Bar */}
      {nodes.length > 0 && (
        <m.div
          variants={statsBarVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.3 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '8px 16px',
            background: colors.surface2,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            flexShrink: 0,
          }}
        >
          <StatChip label="Nodes" value={networkStats.nodeCount} color={colors.accentBlue} />
          <StatChip label="Links" value={networkStats.linkCount} color={colors.accentGreen} />
          <StatChip label="Events/s" value={Number(networkStats.eventsPerSec.toFixed(1))} color={colors.accentYellow} />
          <StatChip label="Active Layers" value={networkStats.activeLayers} color={colors.accentPurple} />
          <div style={{ flex: 1 }} />
          {/* Layer activity mini-indicators */}
          <div style={{ display: 'flex', gap: 4 }}>
            {layerDefs.map((layer) => {
              const count = networkStats.layerBreakdown[layer.key] || 0;
              return (
                <div
                  key={layer.key}
                  title={`${layer.name}: ${count} events (30s)`}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: count > 0 ? layer.color : `${layer.color}30`,
                    boxShadow: count > 0 ? `0 0 6px ${layer.color}60` : 'none',
                    transition: 'all 0.3s ease',
                  }}
                />
              );
            })}
          </div>
        </m.div>
      )}

      {/* SVG Graph */}
      <div style={{ flex: 1, position: 'relative' }}>
        <svg
          ref={svgRef}
          style={{ width: '100%', height: '100%', background: colors.surface1 }}
        />

        {/* Link Hover Tooltip */}
        {hoveredLink && (
          <div
            style={{
              position: 'fixed',
              left: hoveredLink.x + 12,
              top: hoveredLink.y - 10,
              background: colors.surface2,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: 8,
              padding: '8px 12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
              zIndex: 100,
              minWidth: 140,
            }}
          >
            <LinkTooltipContent from={hoveredLink.from} to={hoveredLink.to} />
          </div>
        )}

        {/* Node Detail Panel */}
        <AnimatePresence>
          {selectedNodeData && (
            <m.div
              key={selectedNodeData.short_id}
              variants={detailVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ duration: 0.2 }}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 300,
                background: colors.surface2,
                border: `1px solid ${colors.borderStrong}`,
                borderRadius: 12,
                padding: 0,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
            >
              {/* Header with layer color accent */}
              <div style={{
                padding: '14px 16px 12px',
                background: `linear-gradient(135deg, ${selectedNodeData.layerColor}15, transparent)`,
                borderBottom: `1px solid ${colors.borderSubtle}`,
              }}>
                <button
                  onClick={() => setSelectedNode(null)}
                  style={{
                    position: 'absolute', top: 10, right: 12,
                    background: 'none', border: 'none', color: colors.textDim,
                    cursor: 'pointer', fontSize: 16, lineHeight: 1,
                  }}
                >
                  x
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${selectedNodeData.layerColor}, ${selectedNodeData.layerColor}80)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 800, color: '#fff',
                    boxShadow: `0 0 12px ${selectedNodeData.layerColor}40`,
                  }}>
                    {selectedNodeData.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{selectedNodeData.name}</div>
                    <div style={{ fontSize: 10, color: colors.textDim, fontFamily: fonts.mono }}>{selectedNodeData.short_id}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{
                      fontSize: 18, fontWeight: 800, color: colors.accentBlue,
                      fontFamily: fonts.mono,
                    }}>
                      {selectedNodeData.eventCount}
                    </div>
                    <div style={{ fontSize: 9, color: colors.textDim }}>events/30s</div>
                  </div>
                </div>
              </div>

              {/* Connection Details */}
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <DetailBox label="Address" value={selectedNodeData.address} />
                  <DetailBox label="Port" value={String(selectedNodeData.port)} />
                  <DetailBox label="Peers" value={String(selectedNodeData.peer_count)} />
                  <DetailBox label="Services" value={String(selectedNodeData.services?.length || 0)} />
                </div>

                {/* Services list */}
                {selectedNodeData.services?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Services</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {selectedNodeData.services.map((svc) => (
                        <span key={svc} style={{
                          fontSize: 10, fontFamily: fonts.mono,
                          background: `${colors.accentBlue}15`,
                          border: `1px solid ${colors.accentBlue}30`,
                          borderRadius: 4, padding: '2px 6px',
                          color: colors.accentBlue,
                        }}>
                          {svc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Events */}
                {selectedNodeData.recentEvents.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Recent Activity</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {selectedNodeData.recentEvents.map((evt, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '3px 6px', borderRadius: 4,
                          background: `${layerColors[evt.layer] || colors.accentBlue}08`,
                        }}>
                          <div style={{
                            width: 4, height: 4, borderRadius: '50%',
                            background: layerColors[evt.layer] || colors.textDim,
                            flexShrink: 0,
                          }} />
                          <span style={{
                            fontSize: 10, fontFamily: fonts.mono,
                            color: layerColors[evt.layer] || colors.textDim,
                          }}>
                            {evt.layer}
                          </span>
                          <span style={{ fontSize: 10, color: colors.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {evt.type}
                          </span>
                          <span style={{ fontSize: 9, color: colors.textDim, flexShrink: 0 }}>
                            {formatRelativeTime(evt.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Node ID */}
                <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${colors.borderSubtle}` }}>
                  <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Node ID</div>
                  <div style={{
                    fontSize: 10, color: colors.textDim, fontFamily: fonts.mono,
                    wordBreak: 'break-all', lineHeight: 1.4,
                  }}>
                    {selectedNodeData.node_id}
                  </div>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontSize: 16, fontWeight: 700, color,
        fontFamily: fonts.mono,
      }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </span>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: `rgba(255,255,255,0.03)`,
      border: `1px solid ${colors.borderSubtle}`,
      borderRadius: 6,
      padding: '6px 8px',
    }}>
      <div style={{ fontSize: 9, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, fontFamily: fonts.mono }}>{value}</div>
    </div>
  );
}

function LinkTooltipContent({ from, to }: { from: string; to: string }) {
  const nodes = useValhallaStore((s) => s.nodes);
  const events = useValhallaStore((s) => s.events);

  const fromName = getNodeNameByShortId(from, nodes);
  const toName = getNodeNameByShortId(to, nodes);

  const linkKey = [from, to].sort().join('-');
  const recentEvents = useMemo(() => {
    const recentWindow = Date.now() - 30000;
    return events.filter(e => {
      if (e.timestamp < recentWindow || e.layer === 'demo') return false;
      const eFrom = e.node_id?.slice(0, 12);
      const eTo = e.data?.peer?.slice(0, 12) || e.data?.target?.slice(0, 12) || e.data?.from?.slice(0, 12);
      if (!eFrom || !eTo) return false;
      return [eFrom, eTo].sort().join('-') === linkKey;
    });
  }, [events, linkKey]);

  const layers = useMemo(() => {
    const set = new Set<string>();
    for (const evt of recentEvents) set.add(evt.layer);
    return Array.from(set);
  }, [recentEvents]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.accentBlue }}>{fromName}</span>
        <span style={{ fontSize: 10, color: colors.textDim }}>-</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.accentBlue }}>{toName}</span>
      </div>
      <div style={{ fontSize: 10, color: colors.textMuted }}>
        {recentEvents.length} events (30s)
      </div>
      {layers.length > 0 && (
        <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
          {layers.map(l => (
            <span key={l} style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3,
              background: `${layerColors[l]}20`,
              color: layerColors[l],
              fontWeight: 600,
            }}>
              {l}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
