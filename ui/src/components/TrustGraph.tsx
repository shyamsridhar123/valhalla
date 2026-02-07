import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { m } from 'framer-motion';
import { useValhallaStore } from '../store/useValhallaStore';
import { NODE_NAMES, colors, fonts } from '../theme';
import { appendGlowFilter, appendArrowMarker, createDragBehavior, getContainerDimensions } from '../utils/d3-helpers';

interface TrustGraphProps {
  attestations: { attester: string; subject: string; claim: string; confidence: number }[];
}

interface SelectedEdge {
  attester: string;
  subject: string;
  claim: string;
  confidence: number;
  attesterName: string;
  subjectName: string;
}

export function TrustGraph({ attestations }: TrustGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodes = useValhallaStore((s) => s.nodes);
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null);

  // Map short_id to friendly name using node index
  const nameMap = new Map<string, string>();
  nodes.forEach((n, i) => {
    nameMap.set(n.short_id, NODE_NAMES[i] || `Node ${i}`);
  });

  const getName = (id: string) => nameMap.get(id) || id.slice(0, 8);

  // Compute unique nodes
  const nodeSet = new Set<string>();
  for (const a of attestations) {
    nodeSet.add(a.attester);
    nodeSet.add(a.subject);
  }

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = getContainerDimensions(svgRef.current);

    svg.selectAll('*').remove();

    if (attestations.length === 0) return;

    interface GNode extends d3.SimulationNodeDatum {
      id: string;
      label: string;
    }

    interface GEdge extends d3.SimulationLinkDatum<GNode> {
      source: string | GNode;
      target: string | GNode;
      claim: string;
      confidence: number;
    }

    const graphNodes: GNode[] = [...nodeSet].map((id) => ({
      id,
      label: getName(id),
    }));

    const edges: GEdge[] = attestations.map((a) => ({
      source: a.attester,
      target: a.subject,
      claim: a.claim,
      confidence: a.confidence,
    }));

    const simulation = d3
      .forceSimulation(graphNodes)
      .force(
        'link',
        d3
          .forceLink<GNode, GEdge>(edges)
          .id((d) => d.id)
          .distance(200)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const defs = svg.append('defs');
    appendArrowMarker(defs, 'trust-arrow', colors.accentOrange, 40);
    appendGlowFilter(defs, 'trust-glow', 3);

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
      .data(edges)
      .join('line')
      .attr('stroke', colors.accentOrange)
      .attr('stroke-opacity', (d) => 0.3 + d.confidence * 0.6)
      .attr('stroke-width', (d) => 1 + d.confidence * 3)
      .attr('marker-end', 'url(#trust-arrow)')
      .style('cursor', 'pointer')
      .on('click', (_, d) => {
        const src = typeof d.source === 'string' ? d.source : d.source.id;
        const tgt = typeof d.target === 'string' ? d.target : d.target.id;
        setSelectedEdge({
          attester: src,
          subject: tgt,
          claim: d.claim,
          confidence: d.confidence,
          attesterName: getName(src),
          subjectName: getName(tgt),
        });
      });

    // Confidence labels on edges
    const linkLabel = g
      .append('g')
      .selectAll('g')
      .data(edges)
      .join('g');

    linkLabel
      .append('rect')
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', colors.surface1)
      .attr('stroke', `${colors.accentOrange}66`)
      .attr('stroke-width', 1)
      .attr('width', 50)
      .attr('height', 20)
      .attr('x', -25)
      .attr('y', -12);

    linkLabel
      .append('text')
      .attr('fill', colors.accentOrange)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .text((d) => `${(d.confidence * 100).toFixed(0)}%`);

    // Nodes
    const node = g
      .append('g')
      .selectAll<SVGGElement, GNode>('g')
      .data(graphNodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(createDragBehavior(simulation));

    // Outer ring
    node
      .append('circle')
      .attr('r', 30)
      .attr('fill', 'none')
      .attr('stroke', colors.accentOrange)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.5);

    // Main circle
    node
      .append('circle')
      .attr('r', 24)
      .attr('fill', colors.accentOrange)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#trust-glow)');

    // Name label
    node
      .append('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#fff')
      .attr('font-size', '12px')
      .attr('font-weight', '700')
      .attr('font-family', fonts.ui);

    // ID label below
    node
      .append('text')
      .text((d) => d.id.slice(0, 8))
      .attr('text-anchor', 'middle')
      .attr('dy', '3em')
      .attr('fill', colors.textDim)
      .attr('font-size', '9px')
      .attr('font-family', fonts.mono);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabel.attr('transform', (d: any) =>
        `translate(${(d.source.x + d.target.x) / 2},${(d.source.y + d.target.y) / 2})`
      );

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [attestations, nodes]);

  const uniqueNodes = [...nodeSet];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ color: colors.textSecondary, margin: 0, marginBottom: 4 }}>Web of Trust</h3>
            <span style={{ color: colors.textDim, fontSize: 13 }}>
              Decentralized trust via cryptographic attestations — no certificate authorities
            </span>
          </div>
          {attestations.length > 0 && (
            <div style={{ display: 'flex', gap: 16 }}>
              <Stat label="Nodes" value={uniqueNodes.length} color={colors.accentOrange} />
              <Stat label="Attestations" value={attestations.length} color={colors.accentOrange} />
            </div>
          )}
        </div>
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Graph */}
        <div style={{ flex: 1, position: 'relative', minHeight: 350 }}>
          {attestations.length === 0 ? (
            <EmptyState />
          ) : (
            <svg
              ref={svgRef}
              style={{ width: '100%', height: '100%', background: colors.surface1 }}
            />
          )}
        </div>

        {/* Detail sidebar */}
        {attestations.length > 0 && (
          <div style={{
            width: 260,
            borderLeft: `1px solid ${colors.borderSubtle}`,
            padding: 16,
            overflowY: 'auto',
          }}>
            <h4 style={{ color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>
              Attestations
            </h4>
            {attestations.map((a, i) => (
              <m.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                style={{
                  background: selectedEdge?.attester === a.attester && selectedEdge?.subject === a.subject
                    ? `${colors.accentOrange}20`
                    : colors.surface3,
                  border: `1px solid ${
                    selectedEdge?.attester === a.attester && selectedEdge?.subject === a.subject
                      ? `${colors.accentOrange}60`
                      : colors.borderSubtle
                  }`,
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedEdge({
                  attester: a.attester,
                  subject: a.subject,
                  claim: a.claim,
                  confidence: a.confidence,
                  attesterName: getName(a.attester),
                  subjectName: getName(a.subject),
                })}
              >
                <div style={{ fontSize: 13, color: '#fff', marginBottom: 6 }}>
                  <span style={{ color: colors.accentOrange, fontWeight: 700 }}>{getName(a.attester)}</span>
                  <span style={{ color: colors.textDim }}> attests </span>
                  <span style={{ color: colors.accentOrange, fontWeight: 700 }}>{getName(a.subject)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>{a.claim}</span>
                  <ConfidenceBar value={a.confidence} />
                </div>
              </m.div>
            ))}

            {/* Selected detail */}
            {selectedEdge && (
              <div style={{
                marginTop: 16,
                padding: 12,
                background: `${colors.accentOrange}0d`,
                border: `1px solid ${colors.accentOrange}30`,
                borderRadius: 8,
              }}>
                <h4 style={{ color: colors.accentOrange, fontSize: 12, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Detail
                </h4>
                <DetailRow label="Attester" value={selectedEdge.attesterName} sub={selectedEdge.attester} />
                <DetailRow label="Subject" value={selectedEdge.subjectName} sub={selectedEdge.subject} />
                <DetailRow label="Claim" value={selectedEdge.claim} />
                <DetailRow label="Confidence" value={`${(selectedEdge.confidence * 100).toFixed(0)}%`} />
                <div style={{ marginTop: 8, fontSize: 11, color: colors.textMuted, lineHeight: 1.5 }}>
                  {selectedEdge.attesterName} cryptographically signed that they trust {selectedEdge.subjectName} with
                  {' '}{(selectedEdge.confidence * 100).toFixed(0)}% confidence for the claim "{selectedEdge.claim}".
                </div>
              </div>
            )}

            {/* Legend */}
            <div style={{ marginTop: 20, padding: 12, background: colors.surface3, borderRadius: 8 }}>
              <h4 style={{ color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
                How it works
              </h4>
              <div style={{ fontSize: 11, color: colors.textDim, lineHeight: 1.6 }}>
                Nodes sign attestations about each other using Ed25519 keys. Trust flows transitively
                with decay — if Alice trusts Bob at 90% and Bob trusts Carol at 85%, Alice's transitive
                trust in Carol is ~61%. No central authority required.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 48,
        height: 4,
        background: `${colors.borderSubtle}`,
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${value * 100}%`,
          height: '100%',
          background: colors.accentOrange,
          borderRadius: 2,
        }} />
      </div>
      <span style={{ fontSize: 11, color: colors.accentOrange, fontWeight: 600 }}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function DetailRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: colors.textFaint, fontFamily: fonts.mono }}>{sub}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: 350,
      background: colors.surface1,
      padding: 32,
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        border: `2px dashed ${colors.accentOrange}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={`${colors.accentOrange}80`} strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <div style={{ color: colors.textMuted, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
        No trust relationships yet
      </div>
      <div style={{ color: colors.textFaint, fontSize: 13, textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
        Run the <span style={{ color: colors.accentOrange, fontWeight: 600 }}>trust-web</span> scenario
        from the Demos tab to see nodes build a decentralized web of trust through
        cryptographic attestations.
      </div>
    </div>
  );
}
