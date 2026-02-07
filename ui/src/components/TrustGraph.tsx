import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface TrustNode {
  id: string;
  label: string;
}

interface TrustEdge {
  source: string;
  target: string;
  claim: string;
  confidence: number;
}

interface TrustGraphProps {
  attestations: { attester: string; subject: string; claim: string; confidence: number }[];
}

export function TrustGraph({ attestations }: TrustGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 500;
    const height = svgRef.current.clientHeight || 350;

    svg.selectAll('*').remove();

    if (attestations.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .text('No trust relationships yet. Run the trust-web scenario.');
      return;
    }

    const nodeSet = new Set<string>();
    const edges: TrustEdge[] = [];
    for (const a of attestations) {
      nodeSet.add(a.attester);
      nodeSet.add(a.subject);
      edges.push({
        source: a.attester,
        target: a.subject,
        claim: a.claim,
        confidence: a.confidence,
      });
    }

    const nodes: TrustNode[] = [...nodeSet].map((id) => ({ id, label: id }));

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force(
        'link',
        d3
          .forceLink(edges)
          .id((d: any) => d.id)
          .distance(150)
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Arrow markers
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 35)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', '#e67e22')
      .attr('d', 'M0,-5L10,0L0,5');

    const g = svg.append('g');

    const link = g
      .append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', '#e67e22')
      .attr('stroke-opacity', (d) => d.confidence)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrow)');

    // Edge labels
    const linkLabel = g
      .append('g')
      .selectAll('text')
      .data(edges)
      .join('text')
      .attr('fill', '#e67e22')
      .attr('font-size', '10px')
      .attr('text-anchor', 'middle')
      .text((d) => `${d.claim} (${d.confidence.toFixed(2)})`);

    const node = g
      .append('g')
      .selectAll<SVGGElement, any>('g')
      .data(nodes)
      .join('g');

    node
      .append('circle')
      .attr('r', 20)
      .attr('fill', '#e67e22')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    node
      .append('text')
      .text((d: any) => d.label.slice(0, 6))
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#fff')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 8);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [attestations]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 350 }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', background: '#1a1a2e' }}
      />
    </div>
  );
}
