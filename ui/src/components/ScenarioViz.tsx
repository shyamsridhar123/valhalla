import { useMemo } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { colors, fonts } from '../theme';
import type { StackEvent } from '../types/api';
import { SCENARIO_META } from './scenarioMeta';

interface ScenarioVizProps {
  scenario: string;
  narrations: StackEvent[];
  isComplete: boolean;
}

export function ScenarioViz({
  scenario,
  narrations,
  isComplete,
}: ScenarioVizProps) {
  const meta = SCENARIO_META[scenario];
  const step = narrations.length;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: meta
            ? `radial-gradient(ellipse at center, ${meta.gradient[0]}08 0%, transparent 70%)`
            : 'transparent',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {scenario === 'mesh-formation' && (
          <MeshFormationViz step={step} isComplete={isComplete} />
        )}
        {scenario === 'encrypted-chat' && (
          <EncryptedChatViz
            step={step}
            narrations={narrations}
            isComplete={isComplete}
          />
        )}
        {scenario === 'content-sharing' && (
          <ContentSharingViz step={step} />
        )}
        {scenario === 'trust-web' && (
          <TrustWebViz step={step} />
        )}
        {scenario === 'service-discovery' && (
          <ServiceDiscoveryViz step={step} />
        )}
        {scenario === 'state-sync' && (
          <StateSyncViz
            step={step}
          />
        )}
      </div>
    </div>
  );
}

// ─── Mesh Formation ────────────────────────────────────────────────────

function MeshFormationViz({
  step,
  isComplete,
}: {
  step: number;
  isComplete: boolean;
}) {
  // Steps: 0=starting, 1-6=nodes joining, 7=mesh formed, 8-13=routing tables
  const visibleNodes = Math.min(Math.max(step - 1, 0), 6);
  const meshFormed = step >= 7;
  const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank'];
  const nodeColors = ['#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#9b59b6', '#e67e22'];

  const positions = useMemo(() => {
    const cx = 250, cy = 200, r = 140;
    return Array.from({ length: 6 }, (_, i) => ({
      x: cx + r * Math.cos(((i * 60) - 90) * (Math.PI / 180)),
      y: cy + r * Math.sin(((i * 60) - 90) * (Math.PI / 180)),
    }));
  }, []);

  return (
    <svg width="500" height="400" viewBox="0 0 500 400" style={{ maxWidth: '100%', maxHeight: '100%' }}>
      {/* Links between visible nodes */}
      {meshFormed &&
        positions.flatMap((p1, i) =>
          positions.slice(i + 1).map((p2, j) => (
            <m.line
              key={`link-${i}-${i + j + 1}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={nodeColors[i]}
              strokeWidth={1}
              strokeOpacity={0.3}
              strokeDasharray="6,4"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 0.3,
                strokeDashoffset: [0, -20],
              }}
              transition={{
                opacity: { duration: 0.5, delay: j * 0.05 },
                strokeDashoffset: { duration: 2, repeat: Infinity, ease: 'linear' },
              }}
            />
          ))
        )}

      {/* Nodes */}
      <AnimatePresence>
        {positions.slice(0, visibleNodes).map((pos, i) => (
          <m.g
            key={`node-${i}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            {/* Glow ring */}
            <m.circle
              cx={pos.x}
              cy={pos.y}
              r={36}
              fill="none"
              stroke={nodeColors[i]}
              strokeWidth={1}
              strokeDasharray="4,3"
              strokeOpacity={0.3}
              animate={
                meshFormed
                  ? { strokeOpacity: [0.2, 0.5, 0.2] }
                  : {}
              }
              transition={
                meshFormed
                  ? { duration: 2, repeat: Infinity, delay: i * 0.3 }
                  : {}
              }
            />
            {/* Main circle */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={28}
              fill={`${nodeColors[i]}20`}
              stroke={nodeColors[i]}
              strokeWidth={2}
            />
            {/* Name */}
            <text
              x={pos.x}
              y={pos.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize={13}
              fontWeight={700}
              fontFamily={fonts.ui}
            >
              {names[i]}
            </text>
            {/* Status */}
            <circle
              cx={pos.x + 20}
              cy={pos.y - 20}
              r={4}
              fill={colors.accentGreen}
            />
          </m.g>
        ))}
      </AnimatePresence>

      {/* Center label */}
      <AnimatePresence>
        {meshFormed && (
          <m.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <text
              x={250}
              y={200}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={colors.textDim}
              fontSize={11}
              fontFamily={fonts.mono}
            >
              {isComplete ? '6-node mesh active' : 'forming mesh...'}
            </text>
          </m.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

// ─── Encrypted Chat ────────────────────────────────────────────────────

function EncryptedChatViz({
  step,
  narrations,
  isComplete,
}: {
  step: number;
  narrations: StackEvent[];
  isComplete: boolean;
}) {
  // Steps: 0=Alice initiates, 1,3,5=messages sent, 2,4,6=delivered, 7=complete
  const messageCount = Math.floor(Math.max(step - 1, 0) / 2);

  const currentMessage = useMemo(() => {
    for (let i = narrations.length - 1; i >= 0; i--) {
      const msg = narrations[i]?.data?.message || '';
      if (msg.includes('encrypted')) {
        const match = msg.match(/: (.+)$/);
        return match?.[1] || '';
      }
    }
    return '';
  }, [narrations]);

  const isAnimating = step > 0 && !isComplete;

  return (
    <svg width="500" height="360" viewBox="0 0 500 360" style={{ maxWidth: '100%', maxHeight: '100%' }}>
      <defs>
        <linearGradient id="chat-path-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2ecc71" />
          <stop offset="100%" stopColor="#e74c3c" />
        </linearGradient>
      </defs>

      {/* Connection path */}
      <m.path
        d="M 120 160 Q 250 100 380 160"
        fill="none"
        stroke="url(#chat-path-grad)"
        strokeWidth={1.5}
        strokeDasharray="8,4"
        initial={{ opacity: 0 }}
        animate={{
          opacity: step > 0 ? 0.4 : 0,
          strokeDashoffset: [0, -24],
        }}
        transition={{
          opacity: { duration: 0.5 },
          strokeDashoffset: { duration: 1.5, repeat: Infinity, ease: 'linear' },
        }}
      />

      {/* Alice node */}
      <m.g
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 150 }}
      >
        <circle cx={100} cy={160} r={40} fill="#2ecc7118" stroke="#2ecc71" strokeWidth={2} />
        <text x={100} y={155} textAnchor="middle" fill="#2ecc71" fontSize={24} fontWeight={800}>A</text>
        <text x={100} y={175} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={600} fontFamily={fonts.ui}>Alice</text>
        {/* Encrypt indicator */}
        {isAnimating && (
          <m.g animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <rect x={80} y={210} width={40} height={18} rx={4} fill="#2ecc7125" stroke="#2ecc71" strokeWidth={1} />
            <text x={100} y={223} textAnchor="middle" fill="#2ecc71" fontSize={9} fontWeight={600}>ENCRYPT</text>
          </m.g>
        )}
      </m.g>

      {/* Bob node */}
      <m.g
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 150, delay: 0.1 }}
      >
        <circle cx={400} cy={160} r={40} fill="#e74c3c18" stroke="#e74c3c" strokeWidth={2} />
        <text x={400} y={155} textAnchor="middle" fill="#e74c3c" fontSize={24} fontWeight={800}>B</text>
        <text x={400} y={175} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={600} fontFamily={fonts.ui}>Bob</text>
        {/* Decrypt indicator */}
        {isAnimating && (
          <m.g animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}>
            <rect x={380} y={210} width={40} height={18} rx={4} fill="#e74c3c25" stroke="#e74c3c" strokeWidth={1} />
            <text x={400} y={223} textAnchor="middle" fill="#e74c3c" fontSize={9} fontWeight={600}>DECRYPT</text>
          </m.g>
        )}
      </m.g>

      {/* Animated message packets */}
      {isAnimating && (
        <m.circle
          r={6}
          fill="#fff"
          animate={{
            cx: [120, 250, 380],
            cy: [160, 120, 160],
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Message counter */}
      <m.g
        initial={{ opacity: 0 }}
        animate={{ opacity: step > 1 ? 1 : 0 }}
      >
        <text x={250} y={270} textAnchor="middle" fill={colors.textDim} fontSize={12} fontFamily={fonts.mono}>
          {messageCount > 0
            ? `${messageCount}/3 messages delivered`
            : 'establishing connection...'}
        </text>
      </m.g>

      {/* Current message preview */}
      {currentMessage && (
        <m.g
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          key={currentMessage}
        >
          <rect x={130} y={290} width={240} height={30} rx={6} fill={`${colors.surface2}`} stroke={colors.borderStrong} strokeWidth={1} />
          <text x={250} y={309} textAnchor="middle" fill={colors.textSecondary} fontSize={10} fontFamily={fonts.mono}>
            {currentMessage.length > 40 ? currentMessage.slice(0, 40) + '...' : currentMessage}
          </text>
        </m.g>
      )}

      {/* Veil shield icon in center */}
      <m.g
        initial={{ opacity: 0 }}
        animate={{ opacity: step > 0 ? 1 : 0 }}
        transition={{ delay: 0.3 }}
      >
        <m.path
          d="M 245 110 L 250 105 L 255 110 L 255 122 Q 250 126 245 122 Z"
          fill="#2ecc7130"
          stroke="#2ecc71"
          strokeWidth={1}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </m.g>
    </svg>
  );
}

// ─── Content Sharing ───────────────────────────────────────────────────

function ContentSharingViz({
  step,
}: {
  step: number;
}) {
  // Steps: 0=publishes, 1=CID created, 2=retrieves, 3=retrieved, 4=signature valid
  const showCID = step >= 2;
  const showRetriever = step >= 3;
  const showVerified = step >= 4;

  return (
    <svg width="520" height="320" viewBox="0 0 520 320" style={{ maxWidth: '100%', maxHeight: '100%' }}>
      {/* Publisher node */}
      <m.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <circle cx={80} cy={160} r={36} fill="#f1c40f15" stroke="#f1c40f" strokeWidth={2} />
        <text x={80} y={152} textAnchor="middle" fill="#f1c40f" fontSize={11} fontWeight={700}>Node 0</text>
        <text x={80} y={168} textAnchor="middle" fill={colors.textDim} fontSize={9}>Publisher</text>

        {/* Document icon */}
        <rect x={65} y={200} width={30} height={36} rx={3} fill="none" stroke="#f1c40f" strokeWidth={1} opacity={0.5} />
        {[210, 216, 222, 228].map((y) => (
          <line key={y} x1={70} y1={y} x2={90} y2={y} stroke="#f1c40f" strokeWidth={0.6} opacity={0.3} />
        ))}
      </m.g>

      {/* Arrow: publisher → CID */}
      {step >= 1 && (
        <m.line
          x1={116}
          y1={160}
          x2={210}
          y2={160}
          stroke="#f1c40f"
          strokeWidth={1.5}
          strokeDasharray="6,4"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 0.5,
            strokeDashoffset: [0, -20],
          }}
          transition={{
            opacity: { duration: 0.3 },
            strokeDashoffset: { duration: 1.5, repeat: Infinity, ease: 'linear' },
          }}
        />
      )}

      {/* CID block */}
      {showCID && (
        <m.g
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring' }}
        >
          <rect x={220} y={130} width={80} height={60} rx={8} fill="#2ecc7115" stroke="#2ecc71" strokeWidth={1.5} />
          <text x={260} y={152} textAnchor="middle" fill="#2ecc71" fontSize={10} fontWeight={700}>SHA-256</text>
          <text x={260} y={168} textAnchor="middle" fill="#2ecc71" fontSize={18}>#{'{'}CID{'}'}</text>
          <text x={260} y={182} textAnchor="middle" fill={colors.textDim} fontSize={8} fontFamily={fonts.mono}>content-addressed</text>
        </m.g>
      )}

      {/* Arrow: CID → retriever */}
      {showRetriever && (
        <m.line
          x1={310}
          y1={160}
          x2={404}
          y2={160}
          stroke="#2ecc71"
          strokeWidth={1.5}
          strokeDasharray="6,4"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 0.5,
            strokeDashoffset: [0, -20],
          }}
          transition={{
            opacity: { duration: 0.3 },
            strokeDashoffset: { duration: 1.5, repeat: Infinity, ease: 'linear' },
          }}
        />
      )}

      {/* Retriever node */}
      {showRetriever && (
        <m.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <circle cx={440} cy={160} r={36} fill="#2ecc7115" stroke="#2ecc71" strokeWidth={2} />
          <text x={440} y={152} textAnchor="middle" fill="#2ecc71" fontSize={11} fontWeight={700}>Node 4</text>
          <text x={440} y={168} textAnchor="middle" fill={colors.textDim} fontSize={9}>Retriever</text>
        </m.g>
      )}

      {/* Verified badge */}
      {showVerified && (
        <m.g
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: 0.3 }}
        >
          <circle cx={260} cy={230} r={16} fill="#2ecc7130" stroke="#2ecc71" strokeWidth={1.5} />
          <text x={260} y={235} textAnchor="middle" fill="#2ecc71" fontSize={16} fontWeight={700}>✓</text>
          <text x={260} y={260} textAnchor="middle" fill={colors.textDim} fontSize={10}>Signature verified</text>
        </m.g>
      )}
    </svg>
  );
}

// ─── Trust Web ─────────────────────────────────────────────────────────

function TrustWebViz({
  step,
}: {
  step: number;
}) {
  // Steps: 0=building, 1=Alice→Bob, 2=Bob→Carol, 3-5=trust scores, 6=decay
  const showAliceBob = step >= 2;
  const showBobCarol = step >= 3;
  const showScores = step >= 4;
  const showTransitive = step >= 5;

  const nodes = [
    { x: 250, y: 80, name: 'Alice', color: '#e67e22' },
    { x: 120, y: 260, name: 'Bob', color: '#3498db' },
    { x: 380, y: 260, name: 'Carol', color: '#2ecc71' },
  ];

  return (
    <svg width="500" height="380" viewBox="0 0 500 380" style={{ maxWidth: '100%', maxHeight: '100%' }}>
      {/* Alice → Bob attestation */}
      {showAliceBob && (
        <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <m.line
            x1={nodes[0].x}
            y1={nodes[0].y + 35}
            x2={nodes[1].x + 25}
            y2={nodes[1].y - 25}
            stroke="#e67e22"
            strokeWidth={2}
            strokeDasharray="8,4"
            animate={{ strokeDashoffset: [0, -24] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          {showScores && (
            <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <rect x={152} y={152} width={50} height={20} rx={10} fill="#e67e22" fillOpacity={0.2} />
              <text x={177} y={166} textAnchor="middle" fill="#e67e22" fontSize={11} fontWeight={700}>0.90</text>
            </m.g>
          )}
        </m.g>
      )}

      {/* Bob → Carol attestation */}
      {showBobCarol && (
        <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <m.line
            x1={nodes[1].x + 35}
            y1={nodes[1].y}
            x2={nodes[2].x - 35}
            y2={nodes[2].y}
            stroke="#3498db"
            strokeWidth={2}
            strokeDasharray="8,4"
            animate={{ strokeDashoffset: [0, -24] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          {showScores && (
            <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <rect x={225} y={248} width={50} height={20} rx={10} fill="#3498db" fillOpacity={0.2} />
              <text x={250} y={262} textAnchor="middle" fill="#3498db" fontSize={11} fontWeight={700}>0.85</text>
            </m.g>
          )}
        </m.g>
      )}

      {/* Transitive: Alice → Carol */}
      {showTransitive && (
        <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          <m.line
            x1={nodes[0].x + 25}
            y1={nodes[0].y + 30}
            x2={nodes[2].x - 20}
            y2={nodes[2].y - 25}
            stroke="#9b59b6"
            strokeWidth={1.5}
            strokeDasharray="4,6"
            strokeOpacity={0.5}
            animate={{ strokeDashoffset: [0, -20] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <rect x={320} y={155} width={68} height={20} rx={10} fill="#9b59b6" fillOpacity={0.2} />
            <text x={354} y={169} textAnchor="middle" fill="#9b59b6" fontSize={10} fontWeight={600}>0.77 (trans.)</text>
          </m.g>
        </m.g>
      )}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <m.g
          key={node.name}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: i * 0.15 }}
        >
          <circle cx={node.x} cy={node.y} r={32} fill={`${node.color}15`} stroke={node.color} strokeWidth={2} />
          <text x={node.x} y={node.y - 4} textAnchor="middle" fill={node.color} fontSize={20} fontWeight={800}>
            {node.name[0]}
          </text>
          <text x={node.x} y={node.y + 14} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={600} fontFamily={fonts.ui}>
            {node.name}
          </text>
        </m.g>
      ))}

      {/* Legend */}
      {showTransitive && (
        <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <text x={250} y={340} textAnchor="middle" fill={colors.textDim} fontSize={10} fontFamily={fonts.mono}>
            Trust decays transitively: 0.9 × 0.85 = 0.77
          </text>
        </m.g>
      )}
    </svg>
  );
}

// ─── Service Discovery ─────────────────────────────────────────────────

function ServiceDiscoveryViz({
  step,
}: {
  step: number;
}) {
  // Steps: 0=register, 1=discovers, 2=file list, 3=retrieved
  const showProvider = step >= 1;
  const showDiscovery = step >= 2;
  const showFiles = step >= 3;
  const showRetrieved = step >= 4;

  return (
    <svg width="500" height="360" viewBox="0 0 500 360" style={{ maxWidth: '100%', maxHeight: '100%' }}>
      {/* Provider node */}
      <m.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <circle cx={140} cy={160} r={40} fill="#f1c40f15" stroke="#f1c40f" strokeWidth={2} />
        <text x={140} y={150} textAnchor="middle" fill="#f1c40f" fontSize={10} fontWeight={700}>Node 2</text>
        <text x={140} y={166} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={600}>Carol</text>

        {/* Service badge */}
        {showProvider && (
          <m.g initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
            <rect x={105} y={210} width={70} height={22} rx={11} fill="#f1c40f20" stroke="#f1c40f" strokeWidth={1} />
            <text x={140} y={225} textAnchor="middle" fill="#f1c40f" fontSize={9} fontWeight={600}>file-storage</text>
          </m.g>
        )}
      </m.g>

      {/* Consumer node */}
      <m.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <circle cx={380} cy={160} r={40} fill="#e74c3c15" stroke="#e74c3c" strokeWidth={2} />
        <text x={380} y={150} textAnchor="middle" fill="#e74c3c" fontSize={10} fontWeight={700}>Node 5</text>
        <text x={380} y={166} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={600}>Frank</text>
      </m.g>

      {/* Discovery waves */}
      {showDiscovery &&
        [0, 1, 2].map((i) => (
          <m.circle
            key={i}
            cx={380}
            cy={160}
            fill="none"
            stroke="#e74c3c"
            strokeWidth={1}
            initial={{ r: 40, opacity: 0 }}
            animate={{
              r: [40, 140],
              opacity: [0.5, 0],
            }}
            transition={{
              duration: 2,
              delay: i * 0.6,
              repeat: Infinity,
            }}
          />
        ))}

      {/* Connection established */}
      {showFiles && (
        <m.line
          x1={180}
          y1={160}
          x2={340}
          y2={160}
          stroke="#2ecc71"
          strokeWidth={2}
          strokeDasharray="8,4"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 0.6,
            strokeDashoffset: [0, -24],
          }}
          transition={{
            opacity: { duration: 0.3 },
            strokeDashoffset: { duration: 1.5, repeat: Infinity, ease: 'linear' },
          }}
        />
      )}

      {/* File list */}
      {showFiles && (
        <m.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <rect x={210} y={240} width={120} height={70} rx={8} fill={colors.surface2} stroke={colors.borderStrong} strokeWidth={1} />
          <text x={220} y={258} fill={colors.textDim} fontSize={9} fontWeight={600}>FILES:</text>
          {['readme.md', 'config.json', 'data.bin'].map((f, i) => (
            <text key={f} x={224} y={274 + i * 14} fill={colors.textSecondary} fontSize={10} fontFamily={fonts.mono}>
              {f}
            </text>
          ))}
        </m.g>
      )}

      {/* Retrieved indicator */}
      {showRetrieved && (
        <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <text x={260} y={335} textAnchor="middle" fill={colors.accentGreen} fontSize={11} fontWeight={600}>
            RPC call successful
          </text>
        </m.g>
      )}
    </svg>
  );
}

// ─── State Sync ────────────────────────────────────────────────────────

function StateSyncViz({
  step,
}: {
  step: number;
}) {
  // Steps: 0=demo start, 1-3=nodes set values, 4=syncing, 5-7=after sync, 8=converged
  const syncing = step >= 5;
  const converged = step >= 8;

  const nodes = [
    { x: 100, name: 'Node 0', color: '#e74c3c' },
    { x: 260, name: 'Node 1', color: '#3498db' },
    { x: 420, name: 'Node 2', color: '#2ecc71' },
  ];

  const preSync = [
    ['room/topic', '"Welcome to Valhalla"'],
    ['room/members', '"3"'],
    ['room/topic', '"Valhalla Chat Room"'],
  ];

  const postSync = '"Valhalla Chat Room"';

  return (
    <svg width="520" height="360" viewBox="0 0 520 360" style={{ maxWidth: '100%', maxHeight: '100%' }}>
      {/* Sync arrows */}
      {syncing && !converged && (
        <>
          {[[0, 1], [1, 2], [0, 2]].map(([from, to], i) => (
            <m.line
              key={i}
              x1={nodes[from].x}
              y1={100}
              x2={nodes[to].x}
              y2={100}
              stroke="#9b59b6"
              strokeWidth={1.5}
              strokeDasharray="6,4"
              animate={{
                strokeDashoffset: [0, from < to ? -20 : 20],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          ))}
          <m.text
            x={260}
            y={80}
            textAnchor="middle"
            fill="#9b59b6"
            fontSize={11}
            fontWeight={600}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            Synchronizing...
          </m.text>
        </>
      )}

      {/* Node columns */}
      {nodes.map((node, i) => {
        const hasValue = step >= i + 2;
        return (
          <m.g
            key={node.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
          >
            {/* Node circle */}
            <circle cx={node.x} cy={140} r={30} fill={`${node.color}15`} stroke={node.color} strokeWidth={2} />
            <text x={node.x} y={137} textAnchor="middle" fill={node.color} fontSize={10} fontWeight={700}>{node.name}</text>
            <text x={node.x} y={152} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={600}>
              {['Alice', 'Bob', 'Carol'][i]}
            </text>

            {/* Value box */}
            {hasValue && (
              <m.g initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                <rect
                  x={node.x - 70}
                  y={190}
                  width={140}
                  height={converged ? 44 : 44}
                  rx={6}
                  fill={converged ? '#2ecc7110' : colors.surface2}
                  stroke={converged ? '#2ecc71' : colors.borderStrong}
                  strokeWidth={1}
                />
                <text x={node.x} y={207} textAnchor="middle" fill={colors.textDim} fontSize={9} fontFamily={fonts.mono}>
                  {preSync[i][0]}
                </text>
                <text x={node.x} y={225} textAnchor="middle" fill={converged ? '#2ecc71' : '#fff'} fontSize={10} fontWeight={600} fontFamily={fonts.mono}>
                  {converged ? postSync : preSync[i][1]}
                </text>
              </m.g>
            )}
          </m.g>
        );
      })}

      {/* Convergence indicator */}
      {converged && (
        <m.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }}>
          <circle cx={260} cy={290} r={18} fill="#2ecc7130" stroke="#2ecc71" strokeWidth={1.5} />
          <text x={260} y={295} textAnchor="middle" fill="#2ecc71" fontSize={18}>✓</text>
          <text x={260} y={325} textAnchor="middle" fill={colors.textDim} fontSize={11} fontFamily={fonts.mono}>
            Last-Writer-Wins convergence
          </text>
        </m.g>
      )}
    </svg>
  );
}
