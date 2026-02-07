import { create } from 'zustand';
import type { NodeInfo, PeerLink, StackEvent, ScenarioInfo, TrustInfo } from '../types/api';

export type ScenarioPhase = 'selecting' | 'playing' | 'complete';

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
  hoveredLink: string | null;
  runningScenario: string | null;
  eventLayerFilter: string | null;
  expandedEventIndex: number | null;

  // Stack tab state
  expandedLayer: string | null;

  // Scenario Theater state
  scenarioPhase: ScenarioPhase;
  scenarioLayerActivity: Record<string, boolean>;
  guidedTourActive: boolean;
  guidedTourIndex: number;

  // Demo mode
  demoMode: 'theater' | 'sandbox';

  // Actions
  setNodes: (nodes: NodeInfo[]) => void;
  setPeers: (peers: PeerLink[]) => void;
  setScenarios: (scenarios: ScenarioInfo[]) => void;
  setAttestations: (attestations: TrustInfo[]) => void;
  addEvent: (event: StackEvent) => void;
  clearEvents: () => void;
  setActiveTab: (tab: ValhallaState['activeTab']) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setHoveredLink: (linkId: string | null) => void;
  setRunningScenario: (name: string | null) => void;
  setEventLayerFilter: (layer: string | null) => void;
  setExpandedEventIndex: (index: number | null) => void;
  setExpandedLayer: (layer: string | null) => void;

  // Scenario Theater actions
  setScenarioPhase: (phase: ScenarioPhase) => void;
  setScenarioLayerActivity: (activity: Record<string, boolean>) => void;
  setGuidedTourActive: (active: boolean) => void;
  setGuidedTourIndex: (index: number) => void;
  resetScenarioState: () => void;

  // Demo mode action
  setDemoMode: (mode: 'theater' | 'sandbox') => void;
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
  hoveredLink: null,
  runningScenario: null,
  eventLayerFilter: null,
  expandedEventIndex: null,
  expandedLayer: null,

  // Scenario Theater defaults
  scenarioPhase: 'selecting',
  scenarioLayerActivity: {},
  guidedTourActive: false,
  guidedTourIndex: 0,

  // Demo mode default
  demoMode: 'theater' as const,

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
  setHoveredLink: (hoveredLink) => set({ hoveredLink }),
  setRunningScenario: (runningScenario) => set({ runningScenario }),
  setEventLayerFilter: (eventLayerFilter) => set({ eventLayerFilter }),
  setExpandedEventIndex: (expandedEventIndex) => set({ expandedEventIndex }),
  setExpandedLayer: (expandedLayer) => set({ expandedLayer }),

  // Scenario Theater actions
  setScenarioPhase: (scenarioPhase) => set({ scenarioPhase }),
  setScenarioLayerActivity: (scenarioLayerActivity) => set({ scenarioLayerActivity }),
  setGuidedTourActive: (guidedTourActive) => set({ guidedTourActive }),
  setGuidedTourIndex: (guidedTourIndex) => set({ guidedTourIndex }),
  resetScenarioState: () =>
    set({
      scenarioPhase: 'selecting',
      runningScenario: null,
      scenarioLayerActivity: {},
      guidedTourActive: false,
      guidedTourIndex: 0,
    }),

  // Demo mode
  setDemoMode: (demoMode) => set({ demoMode }),
}));
