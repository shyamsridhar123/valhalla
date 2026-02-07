import { useRef, useEffect, useMemo } from 'react';
import { useValhallaStore } from '../store/useValhallaStore';
import { colors, layerColors, formatRelativeTime, getNodeNameByShortId, fonts } from '../theme';

export function EventLog() {
  const events = useValhallaStore((s) => s.events);
  const nodes = useValhallaStore((s) => s.nodes);
  const clearEvents = useValhallaStore((s) => s.clearEvents);
  const filter = useValhallaStore((s) => s.eventLayerFilter);
  const setFilter = useValhallaStore((s) => s.setEventLayerFilter);
  const expandedIndex = useValhallaStore((s) => s.expandedEventIndex);
  const setExpandedIndex = useValhallaStore((s) => s.setExpandedEventIndex);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const recent = useMemo(() => {
    const all = events.slice(-200);
    if (!filter) return all;
    return all.filter((e) => e.layer === filter);
  }, [events, filter]);

  // Auto-scroll only if user is at bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [recent.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
  };

  const resolveNames = (data: Record<string, string>) => {
    const nameKeys = ['peer', 'from', 'target', 'subject', 'publisher'];
    const resolved: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (nameKeys.includes(k) && v.length >= 8) {
        const name = getNodeNameByShortId(v, nodes);
        resolved[k] = name !== v.slice(0, 8) ? `${name} (${v})` : v;
      } else {
        resolved[k] = v;
      }
    }
    return resolved;
  };

  const filterLayers = Object.keys(layerColors);

  return (
    <div
      style={{
        background: colors.surface2,
        border: `1px solid ${colors.borderDefault}`,
        borderRadius: 8,
        padding: 12,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: colors.textSecondary, fontWeight: 700, fontSize: 14 }}>
          Events <span style={{ color: colors.textDim, fontWeight: 400 }}>({events.length})</span>
        </span>
        <button
          onClick={clearEvents}
          style={{
            background: 'none',
            border: `1px solid ${colors.textFaint}`,
            borderRadius: 4,
            color: colors.textMuted,
            padding: '2px 8px',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Clear
        </button>
      </div>

      {/* Layer filters */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <FilterPill label="All" color="#fff" active={!filter} onClick={() => setFilter(null)} />
        {filterLayers.map((layer) => (
          <FilterPill
            key={layer}
            label={layer}
            color={layerColors[layer]}
            active={filter === layer}
            onClick={() => setFilter(filter === layer ? null : layer)}
          />
        ))}
      </div>

      {/* Event list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          fontFamily: fonts.mono,
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        {recent.length === 0 ? (
          <span style={{ color: colors.textFaint }}>
            {filter ? `No ${filter} events yet...` : 'No events yet...'}
          </span>
        ) : (
          recent.map((evt, i) => {
            const isExpanded = expandedIndex === i;
            const data = evt.data ? resolveNames(evt.data) : {};
            const entries = Object.entries(data);

            return (
              <div
                key={i}
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                style={{
                  cursor: entries.length > 0 ? 'pointer' : 'default',
                  padding: '2px 0',
                  borderBottom: isExpanded ? `1px solid ${colors.borderSubtle}` : 'none',
                }}
              >
                {/* Summary line */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ color: colors.textDim, fontSize: 10, minWidth: 24 }}>
                    {formatRelativeTime(evt.timestamp)}
                  </span>
                  <span style={{ color: layerColors[evt.layer] || colors.textDim }}>
                    [{evt.layer}]
                  </span>
                  <span style={{ color: '#aaa' }}>{evt.type}</span>
                  {!isExpanded && entries.length > 0 && (
                    <span style={{ color: colors.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entries.slice(0, 2).map(([k, v]) => `${k}=${v}`).join(' ')}
                      {entries.length > 2 && ' ...'}
                    </span>
                  )}
                </div>

                {/* Expanded details */}
                {isExpanded && entries.length > 0 && (
                  <div style={{ paddingLeft: 32, paddingTop: 4, paddingBottom: 4 }}>
                    {entries.map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: colors.textMuted, minWidth: 70 }}>{k}:</span>
                        <span style={{ color: colors.textSecondary, wordBreak: 'break-all' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterPill({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? `${color}20` : 'transparent',
        border: `1px solid ${active ? color : colors.borderDefault}`,
        borderRadius: 12,
        color: active ? color : colors.textDim,
        padding: '1px 8px',
        cursor: 'pointer',
        fontSize: 10,
        fontWeight: active ? 600 : 400,
        textTransform: 'capitalize',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}
