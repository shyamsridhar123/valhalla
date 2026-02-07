import { useEffect, useRef, useCallback } from 'react';
import { useValhallaStore } from '../store/useValhallaStore';
import type { NodeInfo, PeerLink, ScenarioInfo, StackEvent, FullNodeState } from '../types/api';

const API_BASE = 'http://localhost:8080';
const WS_URL = 'ws://localhost:8080/api/events';

export function useValhalla() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const addEvent = useValhallaStore((s) => s.addEvent);
  const setNodes = useValhallaStore((s) => s.setNodes);
  const setPeers = useValhallaStore((s) => s.setPeers);
  const setScenarios = useValhallaStore((s) => s.setScenarios);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      try {
        const event: StackEvent = JSON.parse(msg.data);
        addEvent(event);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [addEvent]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const fetchNodes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/nodes`);
      const data: NodeInfo[] = await res.json();
      setNodes(data);
    } catch {
      // API not available yet
    }
  }, [setNodes]);

  const fetchPeers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/peers`);
      const data: PeerLink[] = await res.json();
      setPeers(data);
    } catch {
      // API not available yet
    }
  }, [setPeers]);

  const fetchScenarios = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/scenarios`);
      const data: ScenarioInfo[] = await res.json();
      setScenarios(data);
    } catch {
      // API not available yet
    }
  }, [setScenarios]);

  const runScenario = useCallback(async (name: string) => {
    try {
      await fetch(`${API_BASE}/api/scenarios/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
    } catch {
      // API not available yet
    }
  }, []);

  const sendMessage = useCallback(async (src: number, dst: number, message: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/interactive/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ src, dst, message }),
      });
      return res.json();
    } catch { return null; }
  }, []);

  const publishContent = useCallback(async (node: number, data: string, title: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/interactive/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node, data, title }),
      });
      return res.json();
    } catch { return null; }
  }, []);

  const setCRDT = useCallback(async (node: number, key: string, value: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/interactive/crdt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node, key, value }),
      });
      return res.json();
    } catch { return null; }
  }, []);

  const disconnectPair = useCallback(async (nodeA: number, nodeB: number) => {
    try {
      await fetch(`${API_BASE}/api/interactive/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeA, nodeB }),
      });
    } catch { /* ignore */ }
  }, []);

  const connectPair = useCallback(async (nodeA: number, nodeB: number) => {
    try {
      await fetch(`${API_BASE}/api/interactive/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeA, nodeB }),
      });
    } catch { /* ignore */ }
  }, []);

  const fetchNodeState = useCallback(async (idx: number): Promise<FullNodeState | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/interactive/state/${idx}`);
      return res.json();
    } catch { return null; }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchNodes();
    fetchPeers();
    fetchScenarios();

    const interval = setInterval(() => {
      fetchNodes();
      fetchPeers();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchNodes, fetchPeers, fetchScenarios]);

  return { fetchNodes, fetchPeers, runScenario, sendMessage, publishContent, setCRDT, disconnectPair, connectPair, fetchNodeState };
}
