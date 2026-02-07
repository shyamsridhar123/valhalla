import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useValhallaStore } from '../store/useValhallaStore';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

export function NetworkGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodes = useValhallaStore((s) => s.nodes);
  const peers = useValhallaStore((s) => s.peers);
  const selectedNode = useValhallaStore((s) => s.selectedNode);
  const setSelectedNode = useValhallaStore((s) => s.setSelectedNode);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 600;
    const height = svgRef.current.clientHeight || 400;

    svg.selectAll('*').remove();

    if (nodes.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .text('Waiting for nodes... Start the daemon with --demo');
      return;
    }

    const graphNodes: GraphNode[] = nodes.map((n) => ({
      id: n.short_id,
      label: n.short_id,
    }));

    // Deduplicate links
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
          .distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const g = svg.append('g');

    // Zoom
    svg.call(
      d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
        g.attr('transform', event.transform);
      })
    );

    // Links
    const link = g
      .append('g')
      .selectAll('line')
      .data(graphLinks)
      .join('line')
      .attr('stroke', '#4a9eff')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 2);

    // Nodes
    const node = g
      .append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(graphNodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_, d) => {
        setSelectedNode(selectedNode === d.id ? null : d.id);
      })
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node
      .append('circle')
      .attr('r', 24)
      .attr('fill', (d) => (d.id === selectedNode ? '#ff6b6b' : '#4a9eff'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    node
      .append('text')
      .text((d) => d.label.slice(0, 8))
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#fff')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

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
  }, [nodes, peers, selectedNode, setSelectedNode]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 400 }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', background: '#1a1a2e' }}
      />
    </div>
  );
}
