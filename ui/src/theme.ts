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

// --- Colors ---
export const colors = {
  surface0: '#0f0f23',
  surface1: '#1a1a2e',
  surface2: '#0d0d1a',
  surface3: '#ffffff06',

  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderDefault: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',

  textPrimary: 'rgba(255, 255, 255, 0.87)',
  textSecondary: '#cccccc',
  textMuted: '#888888',
  textDim: '#777777',
  textFaint: '#555555',

  accentBlue: '#4a9eff',
  accentGreen: '#2ecc71',
  accentRed: '#e74c3c',
  accentOrange: '#e67e22',
  accentYellow: '#f1c40f',

  online: '#2ecc71',
  offline: '#e74c3c',
} as const;

export const layerColors: Record<string, string> = {
  bifrost: '#9b59b6',
  yggdrasil: '#3498db',
  veil: '#2ecc71',
  saga: '#f1c40f',
  rune: '#e67e22',
  realm: '#e74c3c',
  demo: '#4a9eff',
};

export const layers = [
  { name: 'Realm', key: 'realm', color: '#e74c3c', osi: 'Application (L7)', desc: 'P2P RPC, Pub/Sub, CRDT' },
  { name: 'Rune', key: 'rune', color: '#e67e22', osi: 'Presentation (L6)', desc: 'Trust, attestations, capabilities' },
  { name: 'Saga', key: 'saga', color: '#f1c40f', osi: 'Session (L5)', desc: 'Content addressing, intents' },
  { name: 'Veil', key: 'veil', color: '#2ecc71', osi: 'Transport (L4)', desc: 'Encryption, stream mux' },
  { name: 'Yggdrasil', key: 'yggdrasil', color: '#3498db', osi: 'Network (L3)', desc: 'Identity, DHT, routing' },
  { name: 'Bifrost', key: 'bifrost', color: '#9b59b6', osi: 'Data Link (L2)', desc: 'Frame codec, transport' },
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
