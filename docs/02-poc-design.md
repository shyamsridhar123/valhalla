# Proof of Concept: Technical Design

## Goals

Build a working demonstration of the Valhalla overlay stack that:

1. **Runs multiple nodes** in a single process (with in-memory connections) or across processes (with real TCP)
2. **Demonstrates the full layer traversal** -- data structures flowing through all six Valhalla layers with real cryptographic operations
3. **Provides a web UI** that visualizes the overlay stack in real-time
4. **Includes demo scenarios** that showcase the architectural advantages of overlay networking with cryptographic identity

The PoC is not production-grade. It prioritizes clarity and demonstrability over performance and scale.

> **Note on the demo network:** In `--demo` mode, all nodes run as goroutines within a single process and communicate via direct function calls (no TCP). This means no actual network traffic flows between nodes. The layered processing, cryptographic operations, and routing logic all execute for real — but the transport between nodes is an in-memory shortcut. See [06-recommendations.md](./06-recommendations.md) for the path toward real multi-process networking.

---

## Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Core stack | **Go** | Goroutines map 1:1 to layered stack; stdlib crypto; single-binary deploy |
| Noise handshake | **github.com/flynn/noise** | All 15 patterns, used by Nebula in production |
| Ed25519 identity | **crypto/ed25519** (stdlib) | No external deps, maintained by Go team |
| Key exchange | **crypto/ecdh** (stdlib) | X25519 built-in since Go 1.20 |
| Key derivation | **crypto/hkdf** (stdlib) | HKDF built-in since Go 1.24 |
| Symmetric encryption | **golang.org/x/crypto/chacha20poly1305** | AEAD, Go team maintained |
| WebSocket | **nhooyr.io/websocket** | Clean API, works with net/http |
| HTTP API | **net/http** (stdlib) | No framework needed |
| UI | **React 19 + TypeScript** | Component model fits layer visualization |
| Visualization | **D3.js** | Force-directed network topology, trust graphs |
| UI build | **Vite** | Fast dev server, good TypeScript support |
| UI embedding | **go:embed** | Bake built React app into Go binary |

### Dependencies (total: 3 external Go modules)

```
golang.org/x/crypto          # ChaCha20-Poly1305, NaCl, BLAKE2
github.com/flynn/noise       # Noise Protocol Framework
nhooyr.io/websocket          # WebSocket for UI bridge
```

Everything else comes from Go's standard library.

---

## Repository Structure

```
valhalla/
├── docs/                              # Design documents (this folder)
├── cmd/
│   └── valhalla/
│       ├── main.go                    # CLI entry point
│       └── ui-dist/                   # Embedded UI build output (go:embed)
├── internal/
│   ├── types/
│   │   └── types.go                   # NodeID, ContentID, PathAddr, etc.
│   ├── bifrost/                       # Layer 1: Bridge/Transport
│   │   ├── frame.go                   # Frame encoding/decoding
│   │   ├── transport.go               # Transport interface
│   │   ├── tcp.go                     # TCP transport
│   │   └── ws.go                      # WebSocket transport
│   ├── yggdrasil/                     # Layer 2: Mesh/Routing
│   │   ├── identity.go                # Keypair generation, NodeID derivation
│   │   ├── peertable.go               # Kademlia k-bucket peer table
│   │   ├── dht.go                     # DHT operations (store, lookup)
│   │   ├── router.go                  # Message routing
│   │   └── bootstrap.go               # Bootstrap and peer discovery
│   ├── veil/                          # Layer 3: Encrypted Flow
│   │   ├── handshake.go               # Noise XX handshake via flynn/noise
│   │   ├── crypto.go                  # ChaCha20-Poly1305, key derivation
│   │   ├── stream.go                  # Stream multiplexing
│   │   └── connection.go              # Connection manager, pooling
│   ├── saga/                          # Layer 4: Intent/Content
│   │   ├── content.go                 # ContentID, ContentEnvelope
│   │   ├── intent.go                  # WANT, FIND, PUBLISH, SUBSCRIBE
│   │   ├── service.go                 # Service registry
│   │   └── cache.go                   # LRU content cache
│   ├── rune/                          # Layer 5: Trust
│   │   ├── attestation.go             # Attestation creation/verification
│   │   ├── capability.go              # Capability tokens
│   │   └── reputation.go              # Reputation scoring
│   ├── realm/                         # Layer 6: Application
│   │   ├── rpc.go                     # P2P RPC framework
│   │   ├── pubsub.go                  # Pub/sub messaging
│   │   └── crdt.go                    # CRDT state sync (LWW register)
│   ├── node/
│   │   └── node.go                    # ValhallaNode: composes all layers
│   ├── api/
│   │   ├── server.go                  # HTTP/WS API for UI
│   │   └── events.go                  # WebSocket event stream
│   └── demo/
│       ├── network.go                 # Multi-node orchestrator
│       └── scenarios.go               # Pre-built demo scenarios
├── ui/                                # React 19 app (embedded in binary)
│   ├── src/
│   │   ├── App.tsx                    # Main layout with sidebar + panels
│   │   ├── theme.ts                   # Design tokens and color palette
│   │   ├── components/
│   │   │   ├── NetworkGraph.tsx        # D3 force-directed topology
│   │   │   ├── StackView.tsx          # 6-layer stack visualization
│   │   │   ├── TrustGraph.tsx         # Trust/attestation network
│   │   │   ├── DemoRunner.tsx         # Scenario runner UI
│   │   │   ├── ScenarioCard.tsx       # Individual scenario card
│   │   │   ├── ScenarioViz.tsx        # Scenario-specific visualizations
│   │   │   ├── NarrationTimeline.tsx  # Guided narration during demos
│   │   │   ├── LayerActivityBar.tsx   # Per-layer event activity
│   │   │   ├── EventLog.tsx           # Real-time event stream
│   │   │   └── scenarioMeta.ts        # Scenario metadata
│   │   ├── hooks/
│   │   │   └── useValhalla.ts         # WebSocket connection to daemon
│   │   ├── store/
│   │   │   └── useValhallaStore.ts    # Zustand state management
│   │   ├── types/
│   │   │   └── api.ts                 # TypeScript types matching Go API
│   │   └── utils/
│   │       └── d3-helpers.ts          # D3 helper utilities
│   ├── package.json
│   └── vite.config.ts
├── go.mod
├── go.sum
└── Makefile                           # build, dev, demo, test targets
```

---

## Core Architecture

### ValhallaNode

The central struct that composes all layers:

```go
type ValhallaNode struct {
    Identity  *Identity          // Ed25519 keypair + NodeID
    Bifrost   *BifrostLayer      // Transport
    Yggdrasil *YggdrasilLayer    // Mesh routing
    Veil      *VeilLayer         // Encrypted streams
    Saga      *SagaLayer         // Content/intent
    Rune      *RuneLayer         // Trust
    Realm     *RealmLayer        // Application services
    Events    chan StackEvent     // Event bus for UI instrumentation
}

func NewNode(config NodeConfig) (*ValhallaNode, error)
func (n *ValhallaNode) Start(ctx context.Context) error
func (n *ValhallaNode) Stop() error
func (n *ValhallaNode) Connect(nodeID NodeID) (*VeilConnection, error)
```

### Layer Pipeline (goroutines + channels)

Each layer runs as a goroutine, connected by typed channels:

```go
// Data flows down the stack (sending)
realm.outbound → rune.outbound → saga.outbound → veil.outbound → yggdrasil.outbound → bifrost.outbound

// Data flows up the stack (receiving)
bifrost.inbound → yggdrasil.inbound → veil.inbound → saga.inbound → rune.inbound → realm.inbound

// Each layer is a goroutine that reads from its inbound channel,
// processes the message, and writes to the next layer's channel.
func (v *VeilLayer) run(ctx context.Context) {
    for {
        select {
        case msg := <-v.fromYggdrasil:
            decrypted, err := v.decrypt(msg)
            if err != nil {
                v.events <- StackEvent{Layer: "veil", Type: "decrypt_error", Data: err}
                continue
            }
            v.events <- StackEvent{Layer: "veil", Type: "decrypted", Data: decrypted}
            v.toSaga <- decrypted
        case msg := <-v.fromSaga:
            encrypted := v.encrypt(msg)
            v.events <- StackEvent{Layer: "veil", Type: "encrypted", Data: encrypted}
            v.toYggdrasil <- encrypted
        case <-ctx.Done():
            return
        }
    }
}
```

### Event System (for UI instrumentation)

Every layer emits events to a shared channel:

```go
type StackEvent struct {
    Layer     string      `json:"layer"`      // "bifrost", "yggdrasil", etc.
    Type      string      `json:"type"`       // "frame_sent", "peer_discovered", etc.
    Data      interface{} `json:"data"`
    NodeID    string      `json:"node_id"`    // which node emitted this
    Timestamp int64       `json:"timestamp"`  // Unix milliseconds
}
```

The API server fans out events to connected WebSocket clients.

---

## Daemon API

The daemon exposes an HTTP + WebSocket API for the UI:

### REST Endpoints

```
GET    /api/node                    # Node info (NodeID, public key, peers)
GET    /api/peers                   # Connected peers list
GET    /api/content/:cid            # Retrieve content by CID
POST   /api/content                 # Publish content
POST   /api/message                 # Send a message to a peer
GET    /api/trust/:nodeId           # Trust score for a node
POST   /api/scenarios/:name/run     # Run a demo scenario
GET    /api/scenarios               # List available scenarios
```

### WebSocket

```
WS /api/events                     # Real-time event stream from all layers
```

Messages:
```json
{
  "type": "stack_event",
  "event": {
    "layer": "veil",
    "type": "handshake_complete",
    "data": { "peer": "VH5dJk...", "rtt_ms": 12 },
    "node_id": "VH3nR9...",
    "timestamp": 1706817600000
  }
}
```

---

## UI Design

### Main Layout

```
┌──────────────────────────────────────────────────────────┐
│  VALHALLA NETWORK EXPLORER                    [Demos ▾]  │
├───────────────────────┬──────────────────────────────────┤
│                       │                                  │
│  NETWORK TOPOLOGY     │  STACK VIEW                      │
│                       │                                  │
│    ┌──┐               │  ┌──────────────────────────┐  │
│    │A ├──┐            │  │ Realm     [rpc: send_msg] │  │
│    └──┘  │            │  ├──────────────────────────┤  │
│      ┌──┐│            │  │ Rune      [cap: check ✓] │  │
│      │B ├┤            │  ├──────────────────────────┤  │
│      └──┘│            │  │ Saga      [cid: Qm7x...]│  │
│    ┌──┐  │            │  ├──────────────────────────┤  │
│    │C ├──┘            │  │ Veil      [encrypted ███] │  │
│    └──┘               │  ├──────────────────────────┤  │
│  6 nodes, 8 edges    │  │ Yggdrasil [route: A→B→C]│  │
│                       │  ├──────────────────────────┤  │
│                       │  │ Bifrost   [tcp frame 142B]│  │
│                       │  └──────────────────────────┘  │
├───────────────────────┼──────────────────────────────────┤
│  EVENT LOG             │  SCENARIO RUNNER                 │
│                       │                                  │
│  12:00:01 peer_disc   │  [Hello, Valhalla    ] [► Run]   │
│  12:00:02 handshake   │                                  │
│  12:00:03 msg_sent    │  Narration:                      │
│  12:00:03 msg_recv    │  "Two nodes establish a Noise XX  │
│  12:00:04 trust_att   │   handshake and exchange their    │
│                       │   first encrypted message..."     │
└───────────────────────┴──────────────────────────────────┘
```

### Key UI Components

**1. Network Topology Graph** (`NetworkGraph.tsx`)
- D3 force-directed graph showing all nodes and connections
- Nodes colored by role/type, edges show active connections
- Animated packet flow along edges when messages are sent

**2. Stack View** (`StackView.tsx` + `LayerActivityBar.tsx`)
- Vertical stack showing all 6 layers with real-time activity indicators
- Highlights the active layer as a packet traverses
- Shows the transformation at each layer (plaintext → signed → encrypted → framed)

**3. Event Log** (`EventLog.tsx`)
- Real-time stream of stack events from all nodes
- Filterable by layer and event type

**4. Demo Runner** (`DemoRunner.tsx` + `ScenarioCard.tsx` + `ScenarioViz.tsx`)
- Pre-built scenarios with guided walkthroughs
- Scenario-specific visualizations
- Narration timeline explaining what's happening at each layer (`NarrationTimeline.tsx`)

**5. Trust Graph** (`TrustGraph.tsx`)
- Directed graph of attestations between nodes
- Edge labels: claim + confidence
- Node labels: computed trust scores

---

## Demo Scenarios

### Demo 1: "Hello, Valhalla" -- First Message

Simplest possible demo. Two nodes, one sends a message to the other.

**Shows:**
- Identity generation (NodeID from keypair)
- Peer discovery (nodes find each other)
- Noise XX handshake (encrypted connection)
- Message flow through all 6 layers
- Contrast with TCP/IP: "This same message would require DNS lookup, TCP handshake, TLS handshake, HTTP request..."

### Demo 2: "Content, Not Servers" -- Content Addressing

Alice publishes a document. Bob and Carol retrieve it by hash. Carol serves it to Dave without Alice being involved.

**Shows:**
- Content addressing (CID)
- Decoupled identity from location
- Any peer can serve content (no server required)
- Self-verifying integrity (hash matches, signature valid)
- In-network caching

### Demo 3: "Who Are You?" -- Decentralized Trust

Alice attests that Bob is a trusted service provider. Carol trusts Alice. Carol can now derive trust in Bob without a CA.

**Shows:**
- Web of trust vs CA hierarchy
- Attestation creation and verification
- Transitive trust computation
- Capability tokens for access control

### Demo 4: "I Moved" -- Seamless Mobility

A node changes its physical address (simulated by switching transport ports). All connections survive.

**Shows:**
- NodeID stays constant while PathAddr changes
- Location record update propagation
- Connections rebind without interruption
- Contrast: "In TCP/IP, every connection would break"

### Demo 5: "The Mesh" -- Multi-Hop Routing

Six nodes in a mesh. A message from node A reaches node F through intermediate hops, with routing decisions visible at each hop.

**Shows:**
- DHT-based routing
- XOR distance metric
- O(log n) hop routing
- No central router or routing table authority

### Demo 6: "Private by Design" -- Encrypted Everything

Show the wire-level view: an observer on the network sees only encrypted noise.

**Shows:**
- All metadata encrypted
- No SNI equivalent, no DNS leaks
- Contrast with TCP/IP: "Here's what an observer sees on regular internet..."
- Side-by-side: plaintext HTTP vs Valhalla wire format

---

## Multi-Node Simulation

For the PoC, we run multiple nodes in a single process using goroutines. In the current implementation, the demo network uses **in-memory connections** — nodes reference each other directly via Go pointers rather than communicating over TCP. This means:

- No actual TCP connections between nodes
- No Bifrost frames on the wire
- No real network latency (though it can be simulated)
- RPC calls are dispatched directly to the target node's handler

This is an intentional simplification for demo reliability. The layered architecture, cryptographic operations (Ed25519 signing, Noise handshakes, content hashing), and routing logic all execute normally — only the transport between nodes is short-circuited.

```go
type Network struct {
    nodes    map[NodeID]*ValhallaNode
    events   chan StackEvent          // aggregated events from all nodes
    mu       sync.RWMutex
}

// Create a network of N nodes, each on its own TCP port
func NewNetwork(count int, basePort int) (*Network, error)

// Add artificial latency between nodes (wraps net.Conn with a delay)
func (n *Network) SetLatency(a, b NodeID, ms int)

// Simulate a node going offline
func (n *Network) Disconnect(id NodeID) error

// Simulate a node changing address (stop listener, start on new port)
func (n *Network) Migrate(id NodeID, newPort int) error
```

### Addressing in Simulation

Each node listens on a different TCP port on localhost:

```
Node A: /tcp/127.0.0.1:9001
Node B: /tcp/127.0.0.1:9002
Node C: /tcp/127.0.0.1:9003
...
```

The HTTP/WebSocket API server runs on port 8080, serving both the REST API and the embedded React UI.

---

## Simplifications for PoC

| Full Design | PoC Simplification |
|-------------|-------------------|
| Noise IK (1-RTT, requires knowing peer key) | Noise XX (2-RTT, no prior knowledge needed) via flynn/noise |
| Full Kademlia with k-buckets | Simplified routing table with basic XOR lookup |
| Multi-path transport | Single-path only |
| BBR congestion control | No congestion control (localhost doesn't need it) |
| CRDT state sync | Basic last-writer-wins register |
| Full schema system | JSON with type tags |
| Gossip-based pub/sub | Direct broadcast to subscribers |
| Reputation system | Simple attestation count |
| Persistent storage | In-memory only |

These simplifications keep the PoC buildable while still demonstrating the architectural concepts.

---

## Build & Run

```bash
# Build everything (UI + Go binary)
make build
# Produces: ./bin/valhalla (single binary, ~15-20MB, includes React UI)

# Run the demo
./bin/valhalla --demo
# Starts 6 nodes + HTTP/WS server on :8080
# Open http://localhost:8080 in browser

# Development mode (hot-reload UI, auto-rebuild Go)
make dev
```

---

## Performance Targets (PoC)

These are not production targets -- they're sanity checks for the demo:

| Metric | Target |
|--------|--------|
| Network size | 6-20 nodes |
| Handshake latency | < 50ms (localhost) |
| Message delivery | < 100ms (localhost) |
| Content lookup | < 500ms (6 nodes) |
| UI update rate | 60fps animations |
| Event throughput | 1000 events/sec to UI |

---

*Next: [03-implementation-plan.md](./03-implementation-plan.md) -- Implementation Plan*
