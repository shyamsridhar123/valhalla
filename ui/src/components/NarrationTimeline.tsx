import { useEffect, useRef } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { colors, fonts, formatRelativeTime } from '../theme';
import type { StackEvent } from '../types/api';
import { getLayerColor } from './scenarioMeta';

interface NarrationTimelineProps {
  narrations: StackEvent[];
  isComplete: boolean;
}

export function NarrationTimeline({
  narrations,
  isComplete,
}: NarrationTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [narrations.length]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: '12px 16px 8px',
          fontSize: 11,
          fontWeight: 700,
          color: colors.textDim,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Timeline
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px 16px',
        }}
      >
        {narrations.length === 0 && (
          <div
            style={{
              color: colors.textFaint,
              fontSize: 13,
              padding: '24px 0',
              textAlign: 'center',
            }}
          >
            Waiting for events...
          </div>
        )}

        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          {narrations.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 7,
                top: 8,
                bottom: 8,
                width: 1,
                background: colors.borderStrong,
              }}
            />
          )}

          <AnimatePresence initial={false}>
            {narrations.map((evt, i) => {
              const isLast = i === narrations.length - 1;
              const layer = detectLayer(evt.data?.message);

              return (
                <m.div
                  key={`${evt.timestamp}-${i}`}
                  initial={{ opacity: 0, y: 12, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  transition={{
                    duration: 0.3,
                    ease: 'easeOut',
                  }}
                  style={{
                    display: 'flex',
                    gap: 12,
                    paddingBottom: 12,
                    position: 'relative',
                  }}
                >
                  {/* Dot indicator */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <m.div
                      animate={
                        isLast && !isComplete
                          ? {
                              boxShadow: [
                                `0 0 0 0 ${getLayerColor(layer)}40`,
                                `0 0 0 6px ${getLayerColor(layer)}00`,
                              ],
                            }
                          : {}
                      }
                      transition={
                        isLast && !isComplete
                          ? { duration: 1.2, repeat: Infinity }
                          : {}
                      }
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background:
                          isLast && !isComplete
                            ? getLayerColor(layer)
                            : `${getLayerColor(layer)}40`,
                        border: `2px solid ${getLayerColor(layer)}`,
                        marginTop: 2,
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: isLast && !isComplete ? '#fff' : colors.textSecondary,
                        lineHeight: 1.5,
                        fontFamily: fonts.mono,
                        wordBreak: 'break-word',
                      }}
                    >
                      {evt.data?.message}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: colors.textFaint,
                        marginTop: 2,
                      }}
                    >
                      {formatRelativeTime(evt.timestamp)}
                    </div>
                  </div>
                </m.div>
              );
            })}
          </AnimatePresence>

          {/* Completion indicator */}
          {isComplete && narrations.length > 0 && (
            <m.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 0 0 0',
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: colors.accentGreen,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8,
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                ✓
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: colors.accentGreen,
                  fontWeight: 600,
                }}
              >
                Scenario complete
              </span>
            </m.div>
          )}
        </div>
      </div>
    </div>
  );
}

function detectLayer(message?: string): string {
  if (!message) return 'demo';
  const lower = message.toLowerCase();
  if (lower.includes('encrypt') || lower.includes('ciphertext'))
    return 'veil';
  if (lower.includes('attest') || lower.includes('trust')) return 'rune';
  if (lower.includes('content') || lower.includes('cid') || lower.includes('service'))
    return 'saga';
  if (lower.includes('node') && (lower.includes('join') || lower.includes('routing')))
    return 'yggdrasil';
  if (lower.includes('chat') || lower.includes('rpc') || lower.includes('crdt') || lower.includes('sync'))
    return 'realm';
  if (lower.includes('mesh') || lower.includes('peer'))
    return 'bifrost';
  return 'demo';
}
