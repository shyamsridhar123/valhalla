import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { AnimatePresence, m } from 'framer-motion';
import { useValhallaStore } from '../store/useValhallaStore';
import { colors, getNodeName, layerColors, fonts } from '../theme';
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

export function NetworkGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodes = useValhallaStore((s) => s.nodes);
  const peers = useValhallaStore((s) => s.peers);
  const events = useValhallaStore((s) => s.events);
  const selectedNode = useValhallaStore((s) => s.selectedNode);
  const setSelectedNode = useValhallaStore((s) => s.setSelectedNode);

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

  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null;
    const idx = nodes.findIndex((n) => n.short_id === selectedNode);
    if (idx < 0) return null;
    const n = nodes[idx];
    return {
      ...n,
      name: getNodeName(idx),
      layerColor: layerColors[nodeLayerMap.get(n.short_id) || 'yggdrasil'] || colors.accentBlue,
    };
  }, [selectedNode, nodes, nodeLayerMap]);

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
    appendArrowMarker(defs, 'link-arrow', colors.accentBlue, 42);

    // Node gradient
    const gradientColors = [
      { id: 'grad-default', inner: '#4a9eff', outer: '#2a5e9f' },
      { id: 'grad-selected', inner: '#ff6b6b', outer: '#9f3a3a' },
    ];
    for (const gc of gradientColors) {
      const grad = defs.append('radialGradient').attr('id', gc.id);
      grad.append('stop').attr('offset', '0%').attr('stop-color', gc.inner).attr('stop-opacity', '0.9');
      grad.append('stop').attr('offset', '100%').attr('stop-color', gc.outer).attr('stop-opacity', '0.6');
    }

    const g = svg.append('g');

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        })
    );

    // Links
    const link = g
      .append('g')
      .selectAll('line')
      .data(graphLinks)
      .join('line')
      .attr('stroke', colors.accentBlue)
      .attr('stroke-opacity', 0.25)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,4')
      .attr('marker-end', 'url(#link-arrow)');

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
    };
  }, [nodes, peers, selectedNode, setSelectedNode, nodeLayerMap]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 400, position: 'relative' }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', background: colors.surface1 }}
      />

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
              width: 260,
              background: colors.surface2,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'none', border: 'none', color: colors.textDim,
                cursor: 'pointer', fontSize: 16, lineHeight: 1,
              }}
            >
              x
            </button>

            {/* Node header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: selectedNodeData.layerColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, color: '#fff',
              }}>
                {selectedNodeData.name[0]}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{selectedNodeData.name}</div>
                <div style={{ fontSize: 10, color: colors.textDim, fontFamily: fonts.mono }}>{selectedNodeData.short_id}</div>
              </div>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DetailRow label="Address" value={selectedNodeData.address} />
              <DetailRow label="Port" value={String(selectedNodeData.port)} />
              <DetailRow label="Peers" value={String(selectedNodeData.peer_count)} />
              <DetailRow label="Services" value={selectedNodeData.services?.length ? selectedNodeData.services.join(', ') : 'None'} />
              <DetailRow label="Node ID" value={selectedNodeData.node_id} mono />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{
        fontSize: 13, color: '#fff', fontWeight: 500,
        fontFamily: mono ? fonts.mono : fonts.ui,
        wordBreak: 'break-all',
      }}>{value}</div>
    </div>
  );
}
