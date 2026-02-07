import { create } from 'zustand';
import type { NodeInfo, PeerLink, StackEvent, ScenarioInfo, TrustInfo } from '../types/api';

interface ValhallaState {
  // Network state
  nodes: NodeInfo[];
  peers: PeerLink[];
  scenarios: ScenarioInfo[];
  attestations: TrustInfo[];

  // Event stream
  events: StackEvent[];
  maxEvents: number;

  // UI state
  activeTab: 'network' | 'stack' | 'demos' | 'trust';
  selectedNode: string | null;
  runningScenario: string | null;
  eventLayerFilter: string | null;
  expandedEventIndex: number | null;

  // Actions
  setNodes: (nodes: NodeInfo[]) => void;
  setPeers: (peers: PeerLink[]) => void;
  setScenarios: (scenarios: ScenarioInfo[]) => void;
  setAttestations: (attestations: TrustInfo[]) => void;
  addEvent: (event: StackEvent) => void;
  clearEvents: () => void;
  setActiveTab: (tab: ValhallaState['activeTab']) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setRunningScenario: (name: string | null) => void;
  setEventLayerFilter: (layer: string | null) => void;
  setExpandedEventIndex: (index: number | null) => void;
}

export const useValhallaStore = create<ValhallaState>((set) => ({
  nodes: [],
  peers: [],
  scenarios: [],
  attestations: [],
  events: [],
  maxEvents: 500,
  activeTab: 'network',
  selectedNode: null,
  runningScenario: null,
  eventLayerFilter: null,
  expandedEventIndex: null,

  setNodes: (nodes) => set({ nodes }),
  setPeers: (peers) => set({ peers }),
  setScenarios: (scenarios) => set({ scenarios }),
  setAttestations: (attestations) => set({ attestations }),

  addEvent: (event) =>
    set((state) => ({
      events: [...state.events.slice(-(state.maxEvents - 1)), event],
    })),

  clearEvents: () => set({ events: [] }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedNode: (selectedNode) => set({ selectedNode }),
  setRunningScenario: (runningScenario) => set({ runningScenario }),
  setEventLayerFilter: (eventLayerFilter) => set({ eventLayerFilter }),
  setExpandedEventIndex: (expandedEventIndex) => set({ expandedEventIndex }),
}));
