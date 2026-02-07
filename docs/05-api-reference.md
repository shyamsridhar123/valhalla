# Valhalla API Reference

> **Version:** 0.1.0 &nbsp;|&nbsp; **Base URL:** `http://localhost:8080` &nbsp;|&nbsp; **Protocol:** REST + WebSocket

The Valhalla PoC exposes a JSON API from the single Go binary. All endpoints are prefixed with `/api/`. The embedded UI is served at `/`.

---

## Table of Contents

1. [System](#1-system)
2. [Network — Nodes & Peers](#2-network--nodes--peers)
3. [Scenarios](#3-scenarios)
4. [Content](#4-content)
5. [Trust](#5-trust)
6. [Interactive Sandbox](#6-interactive-sandbox)
7. [WebSocket Event Stream](#7-websocket-event-stream)
8. [Data Models](#8-data-models)
9. [Error Handling](#9-error-handling)

---

## 1. System

### `GET /api/health`

Health check. Returns server status, live node count, and a Unix-millisecond timestamp.

**Response `200`**

```json
{
  "status": "ok",
  "nodes": 6,
  "timestamp": 1738900000000
}
```

| Field       | Type    | Description                        |
|-------------|---------|------------------------------------|
| `status`    | string  | Always `"ok"` when the server is up |
| `nodes`     | integer | Number of nodes in the demo network |
| `timestamp` | integer | Server time (Unix ms)              |

### `GET /api/docs`

Returns the full OpenAPI 3.0.3 specification as JSON. This is what the UI's **API Docs** modal fetches.

---

## 2. Network — Nodes & Peers

### `GET /api/nodes`

Lists every node in the demo network.

**Response `200`** — `NodeInfo[]`

```json
[
  {
    "short_id": "VHHPw8d2Rsde",
    "node_id": "VHHPw8d2RsdetPSZm45qvgmM3YJ2cAYDCbZqFh8xDb7aym",
    "address": "127.0.0.1:9001",
    "port": 9001,
    "peers": 5,
    "services": ["file-storage"]
  }
]
```

---

### `GET /api/nodes/{index}`

Returns detailed info for a single node.

| Parameter | In   | Type    | Required | Description             |
|-----------|------|---------|----------|-------------------------|
| `index`   | path | integer | yes      | Zero-based node index   |

**Response `200`** — `NodeInfo`

**Response `400`** — Invalid index  
**Response `404`** — Node not found

---

### `GET /api/peers`

Returns every directed peer link in the network.

**Response `200`** — `PeerLink[]`

```json
[
  { "from": "VHHPw8d2Rsde", "to": "VHAi3CKSVxFA" },
  { "from": "VHHPw8d2Rsde", "to": "VHCjub5Lk5HL" }
]
```

| Field  | Type   | Description                  |
|--------|--------|------------------------------|
| `from` | string | Source node short ID         |
| `to`   | string | Destination node short ID    |

---

## 3. Scenarios

### `GET /api/scenarios`

Lists all available demo scenarios.

**Response `200`** — `ScenarioInfo[]`

```json
[
  {
    "name": "mesh-formation",
    "description": "6 nodes discover each other and form a mesh network"
  },
  {
    "name": "encrypted-chat",
    "description": "Two nodes establish encrypted communication and exchange messages"
  }
]
```

---

### `POST /api/scenarios/run`

Starts a named scenario in the background. Progress is streamed as narration events over the [WebSocket](#7-websocket-event-stream).

**Request Body**

```json
{
  "name": "content-sharing"
}
```

| Field  | Type   | Required | Description        |
|--------|--------|----------|--------------------|
| `name` | string | yes      | Scenario name      |

**Response `200`**

```json
{
  "status": "running",
  "scenario": "content-sharing"
}
```

**Response `404`** — Scenario not found

---

## 4. Content

### `GET /api/content`

Aggregates content metadata from all node caches. Content items appear after being published via the interactive endpoint or a scenario.

**Response `200`** — `ContentInfo[]`

```json
[
  {
    "cid": "bafkreig5svbon...",
    "size": 1024,
    "publisher": "VHHPw8d2Rsde"
  }
]
```

---

## 5. Trust

### `GET /api/trust`

Returns all trust attestations aggregated from every node's trust store.

**Response `200`** — `TrustInfo[]`

```json
[
  {
    "attester": "VHHPw8d2Rsde",
    "subject": "VHAi3CKSVxFA",
    "claim": "reliable-peer",
    "confidence": 0.85
  }
]
```

| Field        | Type   | Description                                     |
|--------------|--------|-------------------------------------------------|
| `attester`   | string | Short ID of the node making the attestation     |
| `subject`    | string | Short ID of the node being attested             |
| `claim`      | string | Free-text claim (e.g. `"reliable-peer"`)        |
| `confidence` | number | Confidence score, `0.0` – `1.0`                |

---

## 6. Interactive Sandbox

These `POST` endpoints let the UI (or any client) drive live interactions between nodes.

---

### `POST /api/interactive/message`

Sends an RPC chat message between two nodes via the Veil encrypted channel.

**Request Body**

```json
{
  "src": 0,
  "dst": 2,
  "message": "Hello from Alice!"
}
```

| Field     | Type    | Required | Description               |
|-----------|---------|----------|---------------------------|
| `src`     | integer | yes      | Source node index          |
| `dst`     | integer | yes      | Destination node index     |
| `message` | string  | yes      | Message payload            |

**Response `200`**

```json
{
  "status": "delivered",
  "from": "VHAi3CKSVxFA",
  "to": "VHGmb9XvNoa4"
}
```

**Side effects:**
- Emits a `veil/encrypt` event on the source node
- Registers an ephemeral `chat` RPC handler on the target if not already present
- Target emits a `realm/chat_received` event
- A `demo/narration` event is broadcast

---

### `POST /api/interactive/trust`

Creates a trust attestation from one node about another and stores it on both.

**Request Body**

```json
{
  "src": 0,
  "dst": 3,
  "claim": "reliable-peer",
  "confidence": 0.85
}
```

| Field        | Type    | Required | Description                  |
|--------------|---------|----------|------------------------------|
| `src`        | integer | yes      | Attester node index          |
| `dst`        | integer | yes      | Subject node index           |
| `claim`      | string  | yes      | Attestation claim text       |
| `confidence` | number  | yes      | `0.0` – `1.0`               |

**Response `200`**

```json
{
  "status": "created",
  "attester": "VHAi3CKSVxFA",
  "subject": "VHEFUTaQ8Mbz",
  "confidence": 0.85
}
```

**Side effects:**
- Attestation stored on both source and target trust stores
- Source emits `rune/attestation_created`
- A `demo/narration` event is broadcast

---

### `POST /api/interactive/content`

Publishes content-addressed data from a node.

**Request Body**

```json
{
  "node": 1,
  "data": "Hello, decentralized world!",
  "title": "greeting"
}
```

| Field   | Type    | Required | Description                 |
|---------|---------|----------|-----------------------------|
| `node`  | integer | yes      | Publisher node index        |
| `data`  | string  | yes      | Content payload             |
| `title` | string  | no       | Human-readable title        |

**Response `200`**

```json
{
  "status": "published",
  "cid": "bafkreig5svbon...",
  "publisher": "VHCjub5Lk5HL"
}
```

---

### `POST /api/interactive/crdt`

Sets a key in a node's LWW-Register CRDT store and syncs to all peers.

**Request Body**

```json
{
  "node": 0,
  "key": "config/theme",
  "value": "dark"
}
```

| Field   | Type    | Required | Description          |
|---------|---------|----------|----------------------|
| `node`  | integer | yes      | Node index           |
| `key`   | string  | yes      | CRDT register key    |
| `value` | string  | yes      | Value to set         |

**Response `200`**

```json
{
  "status": "set",
  "key": "config/theme",
  "value": "dark",
  "synced_peers": 5
}
```

---

### `GET /api/interactive/state/{index}`

Returns the full internal state of a node, including peers, CRDT store, trust store, and cache size.

| Parameter | In   | Type    | Required | Description        |
|-----------|------|---------|----------|--------------------|
| `index`   | path | integer | yes      | Node index         |

**Response `200`** — Full state object (structure varies by node state)

**Response `404`** — Node not found

---

### `POST /api/interactive/disconnect`

Removes the bidirectional peer connection between two nodes.

**Request Body**

```json
{
  "nodeA": 0,
  "nodeB": 3
}
```

| Field   | Type    | Required | Description       |
|---------|---------|----------|-------------------|
| `nodeA` | integer | yes      | First node index  |
| `nodeB` | integer | yes      | Second node index |

**Response `200`**

```json
{ "status": "disconnected" }
```

---

### `POST /api/interactive/connect`

Re-establishes the bidirectional peer connection between two nodes.

**Request Body**

```json
{
  "nodeA": 0,
  "nodeB": 3
}
```

**Response `200`**

```json
{ "status": "connected" }
```

---

## 7. WebSocket Event Stream

### `GET /api/events` → WebSocket upgrade

Connect to this endpoint to receive a real-time stream of **StackEvent** objects. The server pushes one JSON message per event for every layer event across all nodes.

**Connection example (JavaScript):**

```js
const ws = new WebSocket('ws://localhost:8080/api/events');
ws.onmessage = (msg) => {
  const event = JSON.parse(msg.data);
  console.log(`[${event.layer}] ${event.kind}`, event.detail);
};
```

**Message format:** See [StackEvent](#stackevent) below.

**Backpressure:** If a client is too slow, messages are dropped (non-blocking broadcast).

**Layers emitted:**

| Layer       | OSI Analogy        | Example kinds                                  |
|-------------|--------------------|-------------------------------------------------|
| `bifrost`   | Data Link (L2)     | `frame_sent`, `frame_received`                  |
| `yggdrasil` | Network (L3)       | `peer_discovered`, `dht_store`, `route_found`   |
| `veil`      | Transport (L4)     | `encrypt`, `handshake_complete`, `stream_open`  |
| `saga`      | Session (L5)       | `content_published`, `intent_resolved`          |
| `rune`      | Presentation (L6)  | `attestation_created`, `capability_granted`     |
| `realm`     | Application (L7)   | `rpc_call`, `pubsub_publish`, `crdt_set`        |
| `demo`      | —                  | `narration` (scenario progress messages)        |

---

## 8. Data Models

### NodeInfo

```typescript
interface NodeInfo {
  short_id: string;   // 12-char prefix of the full node ID
  node_id:  string;   // Full base58-encoded node identity
  address:  string;   // Listen address (ip:port)
  port:     number;   // Listen port
  peers:    number;   // Current peer count
  services: string[]; // Registered service names
}
```

### PeerLink

```typescript
interface PeerLink {
  from: string;  // Source node short_id
  to:   string;  // Destination node short_id
}
```

### ScenarioInfo

```typescript
interface ScenarioInfo {
  name:        string;  // Machine-readable scenario name
  description: string;  // Human-readable description
}
```

### ContentInfo

```typescript
interface ContentInfo {
  cid:       string;  // Content-addressed identifier
  size:      number;  // Content size in bytes
  publisher: string;  // Publisher node short_id
}
```

### TrustInfo

```typescript
interface TrustInfo {
  attester:   string;  // Attester node short_id
  subject:    string;  // Subject node short_id
  claim:      string;  // Attestation claim
  confidence: number;  // 0.0 – 1.0
}
```

### StackEvent

Emitted over the WebSocket for every layer event.

```typescript
interface StackEvent {
  id:        string;                      // UUID
  layer:     string;                      // bifrost | yggdrasil | veil | saga | rune | realm | demo
  kind:      string;                      // Event type within the layer
  node_id:   string;                      // Emitting node's full ID
  detail:    Record<string, string>;      // Key-value metadata
  timestamp: number;                      // Unix milliseconds
}
```

---

## 9. Error Handling

All error responses use plain-text bodies with standard HTTP status codes:

| Code | Meaning                            |
|------|------------------------------------|
| 400  | Invalid request body or parameters |
| 404  | Resource not found                 |
| 405  | Method not allowed (wrong verb)    |
| 500  | Internal server error              |

**CORS:** All origins are allowed (`Access-Control-Allow-Origin: *`). Preflight `OPTIONS` requests are handled automatically.

---

## Quick Start

```bash
# Start the demo (Go backend + 6-node mesh)
make dev

# In another terminal, test the API
curl http://localhost:8080/api/health
curl http://localhost:8080/api/nodes
curl http://localhost:8080/api/peers
curl http://localhost:8080/api/scenarios

# Run a scenario
curl -X POST http://localhost:8080/api/scenarios/run \
  -H 'Content-Type: application/json' \
  -d '{"name": "encrypted-chat"}'

# Send a message between nodes
curl -X POST http://localhost:8080/api/interactive/message \
  -H 'Content-Type: application/json' \
  -d '{"src": 0, "dst": 2, "message": "Hello!"}'

# Connect to event stream
websocat ws://localhost:8080/api/events
```
