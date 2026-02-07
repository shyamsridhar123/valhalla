import { layerColors } from '../theme';

export interface ScenarioMeta {
  id: string;
  title: string;
  subtitle: string;
  layers: string[];
  gradient: [string, string];
}

export const SCENARIO_META: Record<string, ScenarioMeta> = {
  'mesh-formation': {
    id: 'mesh-formation',
    title: 'Mesh Formation',
    subtitle: 'Network Bootstrap',
    layers: ['bifrost', 'yggdrasil'],
    gradient: ['#58A6FF', '#8957E5'],
  },
  'encrypted-chat': {
    id: 'encrypted-chat',
    title: 'Encrypted Chat',
    subtitle: 'End-to-End Messaging',
    layers: ['veil', 'realm'],
    gradient: ['#4ECB71', '#f85149'],
  },
  'content-sharing': {
    id: 'content-sharing',
    title: 'Content Sharing',
    subtitle: 'Content-Addressed Storage',
    layers: ['saga', 'veil'],
    gradient: ['#FACC15', '#4ECB71'],
  },
  'trust-web': {
    id: 'trust-web',
    title: 'Trust Web',
    subtitle: 'Decentralized Trust',
    layers: ['rune'],
    gradient: ['#e67e22', '#f85149'],
  },
  'service-discovery': {
    id: 'service-discovery',
    title: 'Service Discovery',
    subtitle: 'Intent-Based Routing',
    layers: ['saga', 'realm'],
    gradient: ['#FACC15', '#f85149'],
  },
  'state-sync': {
    id: 'state-sync',
    title: 'State Sync',
    subtitle: 'CRDT Convergence',
    layers: ['realm'],
    gradient: ['#f85149', '#8957E5'],
  },
};

export const SCENARIO_ORDER = [
  'mesh-formation',
  'encrypted-chat',
  'content-sharing',
  'trust-web',
  'service-discovery',
  'state-sync',
] as const;

export function getLayerColor(layer: string): string {
  return layerColors[layer] || '#38BDF8';
}
