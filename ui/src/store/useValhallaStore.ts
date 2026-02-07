import { create } from 'zustand';
import type { NodeInfo, PeerLink, StackEvent, ScenarioInfo } from '../types/api';

interface ValhallaState {
  // Network state
  nodes: NodeInfo[];
  peers: PeerLink[];
  scenarios: ScenarioInfo[];

  // Event stream
  events: StackEvent[];
  maxEvents: number;

  // UI state
  activeTab: 'network' | 'stack' | 'demos' | 'trust';
  selectedNode: string | null;
  runningScenario: string | null;

  // Actions
  setNodes: (nodes: NodeInfo[]) => void;
  setPeers: (peers: PeerLink[]) => void;
  setScenarios: (scenarios: ScenarioInfo[]) => void;
  addEvent: (event: StackEvent) => void;
  clearEvents: () => void;
  setActiveTab: (tab: ValhallaState['activeTab']) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setRunningScenario: (name: string | null) => void;
}

export const useValhallaStore = create<ValhallaState>((set) => ({
  nodes: [],
  peers: [],
  scenarios: [],
  events: [],
  maxEvents: 500,
  activeTab: 'network',
  selectedNode: null,
  runningScenario: null,

  setNodes: (nodes) => set({ nodes }),
  setPeers: (peers) => set({ peers }),
  setScenarios: (scenarios) => set({ scenarios }),

  addEvent: (event) =>
    set((state) => ({
      events: [...state.events.slice(-(state.maxEvents - 1)), event],
    })),

  clearEvents: () => set({ events: [] }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedNode: (selectedNode) => set({ selectedNode }),
  setRunningScenario: (runningScenario) => set({ runningScenario }),
}));
