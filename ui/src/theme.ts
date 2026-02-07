import type { NodeInfo } from './types/api';

// --- Node Names ---
export const NODE_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank'] as const;

export function getNodeName(index: number): string {
  return NODE_NAMES[index] ?? `Node ${index}`;
}

export function getNodeNameByShortId(shortId: string, nodes: NodeInfo[]): string {
  const idx = nodes.findIndex((n) => n.short_id === shortId);
  return idx >= 0 ? (NODE_NAMES[idx] ?? `Node ${idx}`) : shortId.slice(0, 8);
}

// --- Colors (aligned with assets/branding SVG palette) ---
export const colors = {
  surface0: '#0D1117',
  surface1: '#161B22',
  surface2: '#0D1117',
  surface3: '#21262D14',

  borderSubtle: 'rgba(48, 54, 61, 0.4)',
  borderDefault: '#30363d',
  borderStrong: 'rgba(48, 54, 61, 0.8)',

  textPrimary: '#E6EDF3',
  textSecondary: '#c9d1d9',
  textMuted: '#8b949e',
  textDim: '#6e7681',
  textFaint: '#484f58',

  accentBlue: '#38BDF8',
  accentGreen: '#4ECB71',
  accentRed: '#f85149',
  accentOrange: '#e67e22',
  accentYellow: '#FACC15',
  accentGold: '#FACC15',
  accentPurple: '#8957E5',
  accentTeal: '#4ECDC4',

  online: '#4ECB71',
  offline: '#f85149',
} as const;

export const layerColors: Record<string, string> = {
  bifrost: '#8957E5',
  yggdrasil: '#58A6FF',
  veil: '#4ECB71',
  saga: '#FACC15',
  rune: '#e67e22',
  realm: '#f85149',
  demo: '#38BDF8',
};

export const layers = [
  { name: 'Realm', key: 'realm', color: '#f85149', osi: 'Application (L7)', desc: 'P2P RPC, Pub/Sub, CRDT' },
  { name: 'Rune', key: 'rune', color: '#e67e22', osi: 'Presentation (L6)', desc: 'Trust, attestations, capabilities' },
  { name: 'Saga', key: 'saga', color: '#FACC15', osi: 'Session (L5)', desc: 'Content addressing, intents' },
  { name: 'Veil', key: 'veil', color: '#4ECB71', osi: 'Transport (L4)', desc: 'Encryption, stream mux' },
  { name: 'Yggdrasil', key: 'yggdrasil', color: '#58A6FF', osi: 'Network (L3)', desc: 'Identity, DHT, routing' },
  { name: 'Bifrost', key: 'bifrost', color: '#8957E5', osi: 'Data Link (L2)', desc: 'Frame codec, transport' },
] as const;

// --- Typography ---
export const fonts = {
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  ui: "'Inter', system-ui, -apple-system, sans-serif",
} as const;

// --- Spacing ---
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
} as const;

// --- Border Radius ---
export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
} as const;

// --- Helpers ---
export function formatRelativeTime(unixMs: number): string {
  const diff = Date.now() - unixMs;
  if (diff < 1000) return 'now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  return `${Math.floor(diff / 3600000)}h`;
}
