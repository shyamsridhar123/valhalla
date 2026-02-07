import type { ReactNode } from 'react';
import { m } from 'framer-motion';
import { colors } from '../theme';
import type { ScenarioMeta } from './scenarioMeta';
import { getLayerColor } from './scenarioMeta';

interface ScenarioCardProps {
  meta: ScenarioMeta;
  description: string;
  isDisabled: boolean;
  onSelect: () => void;
}

function hexPoints(cx: number, cy: number, r: number, n: number) {
  return Array.from({ length: n }, (_, i) => ({
    x: cx + r * Math.cos(((i * 360) / n - 90) * (Math.PI / 180)),
    y: cy + r * Math.sin(((i * 360) / n - 90) * (Math.PI / 180)),
  }));
}

function MeshIcon() {
  const pts = hexPoints(44, 44, 24, 6);
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" style={{ overflow: 'visible' }}>
      {pts.flatMap((p1, i) =>
        pts.slice(i + 1).map((p2, j) => (
          <m.line
            key={`l-${i}-${i + j + 1}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="#3498db"
            strokeWidth={0.8}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0.2] }}
            transition={{
              duration: 3,
              delay: (i + j) * 0.06,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
          />
        ))
      )}
      {pts.map((p, i) => (
        <m.circle
          key={`n-${i}`}
          cx={p.x}
          cy={p.y}
          r={5}
          fill="#3498db"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.12, type: 'spring', stiffness: 200 }}
        />
      ))}
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <m.circle
        cx={20}
        cy={44}
        r={10}
        fill="none"
        stroke="#2ecc71"
        strokeWidth={1.5}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <text
        x={20}
        y={48}
        textAnchor="middle"
        fill="#2ecc71"
        fontSize={10}
        fontWeight={700}
      >
        A
      </text>
      <m.circle
        cx={68}
        cy={44}
        r={10}
        fill="none"
        stroke="#e74c3c"
        strokeWidth={1.5}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      />
      <text
        x={68}
        y={48}
        textAnchor="middle"
        fill="#e74c3c"
        fontSize={10}
        fontWeight={700}
      >
        B
      </text>
      <m.line
        x1={31}
        y1={44}
        x2={57}
        y2={44}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={1}
        strokeDasharray="4,3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, strokeDashoffset: [0, -14] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
      <m.rect
        x={38}
        y={37}
        width={12}
        height={10}
        rx={2}
        fill="rgba(46,204,113,0.2)"
        stroke="#2ecc71"
        strokeWidth={1}
        animate={{ opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <m.path
        d="M 42 37 L 42 34 Q 42 30 44 30 Q 46 30 46 34 L 46 37"
        fill="none"
        stroke="#2ecc71"
        strokeWidth={1}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <m.rect
        x={12}
        y={22}
        width={24}
        height={32}
        rx={3}
        fill="none"
        stroke="#f1c40f"
        strokeWidth={1.5}
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      />
      {[30, 36, 42, 48].map((y, i) => (
        <m.line
          key={i}
          x1={17}
          y1={y}
          x2={31}
          y2={y}
          stroke="#f1c40f"
          strokeWidth={0.8}
          strokeOpacity={0.4}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.3 + i * 0.1 }}
        />
      ))}
      <m.circle
        cx={44}
        cy={38}
        r={0}
        fill="none"
        stroke="#2ecc71"
        strokeWidth={1}
        animate={{ r: [0, 8, 16], opacity: [0.8, 0.3, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.8 }}
      />
      <m.rect
        x={58}
        y={28}
        width={18}
        height={20}
        rx={3}
        fill="rgba(46,204,113,0.15)"
        stroke="#2ecc71"
        strokeWidth={1}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      />
      <text
        x={67}
        y={41}
        textAnchor="middle"
        fill="#2ecc71"
        fontSize={8}
        fontWeight={600}
      >
        CID
      </text>
    </svg>
  );
}

function TrustIcon() {
  const pts = [
    { x: 44, y: 18 },
    { x: 22, y: 58 },
    { x: 66, y: 58 },
  ];
  const labels = ['A', 'B', 'C'];
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      {[[0, 1], [1, 2], [0, 2]].map(([from, to], i) => (
        <m.line
          key={i}
          x1={pts[from].x}
          y1={pts[from].y}
          x2={pts[to].x}
          y2={pts[to].y}
          stroke="#e67e22"
          strokeWidth={1}
          strokeDasharray="4,3"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0.3], strokeDashoffset: [0, -14] }}
          transition={{
            duration: 2.5,
            delay: i * 0.4,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
      {pts.map((p, i) => (
        <g key={i}>
          <m.circle
            cx={p.x}
            cy={p.y}
            r={12}
            fill="rgba(230,126,34,0.15)"
            stroke="#e67e22"
            strokeWidth={1.5}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.2, type: 'spring' }}
          />
          <text
            x={p.x}
            y={p.y + 4}
            textAnchor="middle"
            fill="#e67e22"
            fontSize={10}
            fontWeight={700}
          >
            {labels[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      {[12, 22, 32].map((r, i) => (
        <m.circle
          key={i}
          cx={44}
          cy={44}
          r={r}
          fill="none"
          stroke="#f1c40f"
          strokeWidth={0.8}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{
            duration: 2,
            delay: i * 0.4,
            repeat: Infinity,
          }}
        />
      ))}
      <m.circle cx={44} cy={44} r={5} fill="#f1c40f" />
      <m.circle
        cx={68}
        cy={32}
        r={6}
        fill="rgba(231,76,60,0.3)"
        stroke="#e74c3c"
        strokeWidth={1}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
      />
      <text
        x={68}
        y={36}
        textAnchor="middle"
        fill="#e74c3c"
        fontSize={7}
        fontWeight={600}
      >
        svc
      </text>
    </svg>
  );
}

function SyncIcon() {
  const pts = [
    { x: 24, y: 44 },
    { x: 44, y: 44 },
    { x: 64, y: 44 },
  ];
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      {pts.map((p, i) => (
        <m.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={10}
          fill={`rgba(231,76,60,${0.15 + i * 0.05})`}
          stroke="#e74c3c"
          strokeWidth={1.5}
          animate={{
            cx: [p.x, 44, p.x],
            r: [10, 12, 10],
          }}
          transition={{
            duration: 3,
            delay: i * 0.2,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />
      ))}
      <m.circle
        cx={44}
        cy={44}
        r={0}
        fill="none"
        stroke="#9b59b6"
        strokeWidth={1.5}
        animate={{ r: [0, 18], opacity: [0.8, 0] }}
        transition={{ duration: 1.5, delay: 1.5, repeat: Infinity }}
      />
    </svg>
  );
}

const SCENARIO_ICONS: Record<string, () => ReactNode> = {
  'mesh-formation': MeshIcon,
  'encrypted-chat': LockIcon,
  'content-sharing': ContentIcon,
  'trust-web': TrustIcon,
  'service-discovery': RadarIcon,
  'state-sync': SyncIcon,
};

export function ScenarioCard({
  meta,
  description,
  isDisabled,
  onSelect,
}: ScenarioCardProps) {
  const Icon = SCENARIO_ICONS[meta.id];

  return (
    <m.button
      layoutId={`scenario-card-${meta.id}`}
      onClick={onSelect}
      disabled={isDisabled}
      whileHover={isDisabled ? {} : { scale: 1.03, y: -4 }}
      whileTap={isDisabled ? {} : { scale: 0.97 }}
      style={{
        background: `linear-gradient(145deg, ${meta.gradient[0]}12, ${meta.gradient[1]}08)`,
        border: `1px solid ${meta.gradient[0]}25`,
        borderRadius: 16,
        padding: '20px 20px 16px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        color: '#fff',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      {/* Gradient glow overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${meta.gradient[0]}40, transparent)`,
        }}
      />

      {/* Icon */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 12,
          height: 88,
        }}
      >
        {Icon && <Icon />}
      </div>

      {/* Layer dots */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 10,
          justifyContent: 'center',
        }}
      >
        {meta.layers.map((layer) => (
          <div
            key={layer}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: getLayerColor(layer),
              boxShadow: `0 0 6px ${getLayerColor(layer)}60`,
            }}
          />
        ))}
      </div>

      {/* Title */}
      <div
        style={{
          fontWeight: 700,
          fontSize: 15,
          marginBottom: 2,
          textAlign: 'center',
        }}
      >
        {meta.title}
      </div>

      {/* Subtitle */}
      <div
        style={{
          color: meta.gradient[0],
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 6,
          textAlign: 'center',
        }}
      >
        {meta.subtitle}
      </div>

      {/* Description */}
      <div
        style={{
          color: colors.textMuted,
          fontSize: 12,
          lineHeight: 1.4,
          textAlign: 'center',
        }}
      >
        {description}
      </div>
    </m.button>
  );
}
