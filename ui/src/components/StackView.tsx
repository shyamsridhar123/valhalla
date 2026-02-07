import { useMemo } from 'react';
import { m } from 'framer-motion';
import { useValhallaStore } from '../store/useValhallaStore';
import { layers as layerDefs, colors } from '../theme';

const layerVariants = {
  idle: { scale: 1 },
  active: {
    scale: [1, 1.015, 1],
    transition: { duration: 0.8, repeat: Infinity, repeatType: 'reverse' as const },
  },
};

interface StackViewProps {
  activeLayer?: string;
}

export function StackView({ activeLayer }: StackViewProps) {
  const events = useValhallaStore((s) => s.events);
  const setFilter = useValhallaStore((s) => s.setEventLayerFilter);
  const currentFilter = useValhallaStore((s) => s.eventLayerFilter);

  const layerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const evt of events) {
      counts[evt.layer] = (counts[evt.layer] || 0) + 1;
    }
    return counts;
  }, [events]);

  const lastEventByLayer = useMemo(() => {
    const map: Record<string, string> = {};
    for (const evt of events) {
      if (evt.layer !== 'demo') {
        map[evt.layer] = `${evt.type}${evt.data ? ' ' + Object.entries(evt.data).slice(0, 1).map(([k, v]) => `${k}=${v}`).join('') : ''}`;
      }
    }
    return map;
  }, [events]);

  return (
    <div style={{ display: 'flex', gap: 24, padding: 16 }}>
      <div style={{ flex: 1 }}>
        <h3 style={{ color: colors.textSecondary, marginBottom: 12 }}>Valhalla Stack</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {layerDefs.map((layer, i) => {
            const isActive = activeLayer?.toLowerCase() === layer.name.toLowerCase();
            const isFiltered = currentFilter === layer.key;
            const count = layerCounts[layer.key] || 0;
            const lastEvent = lastEventByLayer[layer.key];

            return (
              <m.div
                key={layer.name}
                variants={layerVariants}
                animate={isActive ? 'active' : 'idle'}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => setFilter(isFiltered ? null : layer.key)}
                style={{
                  background: isActive ? layer.color : `${layer.color}22`,
                  border: `2px solid ${isFiltered ? '#fff' : layer.color}`,
                  borderRadius: 8,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'background 0.3s ease, border-color 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: 16 }}>
                      {layer.name}
                    </span>
                    <span style={{ color: isActive ? 'rgba(255,255,255,0.8)' : colors.textSecondary, marginLeft: 12, fontSize: 13 }}>
                      {layer.desc}
                    </span>
                  </div>
                  {count > 0 && (
                    <span style={{
                      background: `${layer.color}30`,
                      color: layer.color,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 10,
                      minWidth: 28,
                      textAlign: 'center',
                    }}>
                      {count}
                    </span>
                  )}
                </div>
                {lastEvent && (
                  <div style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: isActive ? 'rgba(255,255,255,0.6)' : colors.textDim,
                    fontFamily: "'JetBrains Mono', monospace",
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {lastEvent}
                  </div>
                )}
              </m.div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <h3 style={{ color: colors.textSecondary, marginBottom: 12 }}>OSI Equivalent</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {layerDefs.map((layer, i) => (
            <m.div
              key={layer.osi}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              style={{
                background: colors.surface3,
                border: `1px solid ${colors.borderStrong}`,
                borderRadius: 8,
                padding: '12px 16px',
                color: colors.textMuted,
                fontSize: 14,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {layer.osi}
            </m.div>
          ))}
        </div>
      </div>
    </div>
  );
}
