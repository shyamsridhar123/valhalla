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
    gradient: ['#3498db', '#9b59b6'],
  },
  'encrypted-chat': {
    id: 'encrypted-chat',
    title: 'Encrypted Chat',
    subtitle: 'End-to-End Messaging',
    layers: ['veil', 'realm'],
    gradient: ['#2ecc71', '#e74c3c'],
  },
  'content-sharing': {
    id: 'content-sharing',
    title: 'Content Sharing',
    subtitle: 'Content-Addressed Storage',
    layers: ['saga', 'veil'],
    gradient: ['#f1c40f', '#2ecc71'],
  },
  'service-discovery': {
    id: 'service-discovery',
    title: 'Service Discovery',
    subtitle: 'Intent-Based Routing',
    layers: ['saga', 'realm'],
    gradient: ['#f1c40f', '#e74c3c'],
  },
  'state-sync': {
    id: 'state-sync',
    title: 'State Sync',
    subtitle: 'CRDT Convergence',
    layers: ['realm'],
    gradient: ['#e74c3c', '#9b59b6'],
  },
};

export const SCENARIO_ORDER = [
  'mesh-formation',
  'encrypted-chat',
  'content-sharing',
  'service-discovery',
  'state-sync',
] as const;

export function getLayerColor(layer: string): string {
  return layerColors[layer] || '#4a9eff';
}
