export interface NodeInfo {
  node_id: string;
  short_id: string;
  address: string;
  port: number;
  peer_count: number;
  services: string[];
}

export interface PeerLink {
  from: string;
  to: string;
}

export interface StackEvent {
  layer: string;
  type: string;
  data: Record<string, string>;
  node_id: string;
  timestamp: number;
}

export interface ScenarioInfo {
  name: string;
  description: string;
}

export interface TrustInfo {
  attester: string;
  subject: string;
  claim: string;
  confidence: number;
}
