# Implementation Plan

## Overview

The implementation proceeds bottom-up through the stack layers, with the UI developed in parallel once the daemon API exists. Each phase produces something runnable and testable.

**Language:** Go (core stack + daemon), React + TypeScript (UI)
**Reference projects:** Nebula (Go overlay, Noise, crypto identity), WireGuard-go, Syncthing

---

## Phase 0: Project Scaffolding

**Deliverable:** Go module with shared types, Makefile, and a "hello world" between two nodes over TCP.

### Tasks

1. **Initialize Go module**
   - `go mod init github.com/valhalla/valhalla`
   - Directory structure: `cmd/valhalla/`, `internal/`, `ui/`
   - `Makefile` with targets: `build`, `dev`, `test`, `demo`

2. **Define shared types** (`internal/types/types.go`)
   - `NodeID` -- `[32]byte`, with base58 `String()` method
   - `ContentID` -- `[34]byte` (multihash: 1 byte algo + 1 byte length + 32 byte hash)
   - `PathAddr` -- `string` (self-describing address: `/tcp/127.0.0.1:9001`)
   - `BifrostFrame`, `StackEvent`, etc.
   - Layer event types for instrumentation

3. **Add dependencies**
   ```
   go get golang.org/x/crypto
   go get github.com/flynn/noise
   go get nhooyr.io/websocket
   ```

4. **Initialize React UI**
   - `cd ui && npm create vite@latest . -- --template react-ts`
   - Install: `d3`, `@xyflow/react`, `zustand`, `framer-motion`

5. **Verify:** Two goroutines exchange a message over a TCP connection on localhost

---

## Phase 1: Bifrost (Bridge Layer)

**Deliverable:** Two nodes can send and receive framed binary messages over TCP.

### Tasks

1. **Frame codec** (`internal/bifrost/frame.go`)
   - Encode: `BifrostFrame → []byte` (magic bytes + length prefix + type + payload)
   - Decode: `io.Reader → BifrostFrame` (reads length, then payload)
   - Frame types: `DATA`, `CONTROL`, `KEEPALIVE`, `CLOSE`
   - Unit tests with `testing` for roundtrip encoding

2. **Transport interface** (`internal/bifrost/transport.go`)
   ```go
   type Transport interface {
       Listen(ctx context.Context, addr string) (Listener, error)
       Dial(ctx context.Context, addr string) (Conn, error)
   }
   type Conn interface {
       Send(frame *Frame) error
       Receive() (*Frame, error)
       Close() error
       RemoteAddr() string
   }
   ```

3. **TCP transport** (`internal/bifrost/tcp.go`)
   - Implement Transport over `net.TCPListener` / `net.TCPConn`
   - Use `bufio.Reader`/`bufio.Writer` for buffered I/O
   - Length-prefix framing over the stream

4. **WebSocket transport** (`internal/bifrost/ws.go`)
   - Implement Transport over `nhooyr.io/websocket`
   - For browser UI connections (later)

5. **Integration test:** Two nodes exchange 1000 frames over TCP, verify all received correctly

---

## Phase 2: Yggdrasil (Mesh Layer)

**Deliverable:** Nodes generate cryptographic identities, discover peers, and route messages by NodeID.

### Tasks

1. **Identity** (`internal/yggdrasil/identity.go`)
   - Generate Ed25519 keypair via `crypto/ed25519`
   - Derive `NodeID = SHA-256(public_key)` via `crypto/sha256`
   - `Sign(data []byte) []byte` / `Verify(pubkey, data, sig) bool`
   - Persist keypair to JSON file on disk

2. **Peer table** (`internal/yggdrasil/peertable.go`)
   - Kademlia-inspired k-bucket structure
   - `XORDistance(a, b NodeID) NodeID`
   - `AddPeer(info PeerInfo)`, `RemovePeer(id NodeID)`
   - `FindClosest(target NodeID, k int) []PeerInfo`

3. **DHT** (`internal/yggdrasil/dht.go`)
   - `Put(key, value []byte, sig []byte) error`
   - `Get(key []byte) ([]byte, error)`
   - Iterative lookup: query closest known peers, converge
   - Store location records: `NodeID → []PathAddr`

4. **Router** (`internal/yggdrasil/router.go`)
   - Route a message to a NodeID
   - Direct delivery if peer is in table
   - Multi-hop routing via DHT otherwise
   - Protocol messages: `PING`, `FIND_NODE`, `FIND_VALUE`, `STORE`

5. **Bootstrap and discovery**
   - Configurable bootstrap node list
   - On startup: connect to bootstrap nodes, populate peer table

6. **Integration test:** 6 nodes form a mesh, node A can route to node F via intermediate hops

---

## Phase 3: Veil (Encrypted Flow Layer)

**Deliverable:** All communication is encrypted with forward secrecy. Multiple streams per connection.

### Tasks

1. **Noise handshake** (`internal/veil/handshake.go`)
   - Use `flynn/noise` with Noise XX pattern (2-RTT, no prior key knowledge)
   - Configure: `noise.NewCipherSuite(noise.DH25519, noise.CipherChaChaPoly, noise.HashSHA256)`
   - After handshake: extract `CipherState` for send/receive
   - Mutual authentication: both sides learn peer's static Ed25519 public key

2. **Symmetric encryption** (`internal/veil/crypto.go`)
   - Use post-handshake `CipherState` from Noise for bulk encryption
   - ChaCha20-Poly1305 AEAD via `x/crypto/chacha20poly1305`
   - Per-stream key derivation via `crypto/hkdf`
   - Counter-based nonce management

3. **Stream multiplexing** (`internal/veil/stream.go`)
   - Multiplex streams over one encrypted connection
   - Stream header: `[streamID:4][seqNum:8][flags:1][payload]`
   - Each stream is a goroutine pair (read + write)
   - Stream types: reliable-ordered (default), unreliable (best-effort)

4. **Connection manager** (`internal/veil/connection.go`)
   - `sync.Map` of active connections keyed by NodeID
   - Connection pooling (reuse existing connection to same peer)
   - Keepalive goroutine, timeout handling
   - `GetOrDial(nodeID) (*Connection, error)`

5. **Integration test:** Two nodes exchange messages on 10 concurrent streams, all encrypted, verify decryption

---

## Phase 4: Saga (Intent Layer)

**Deliverable:** Content can be published, discovered by hash, and retrieved from any peer holding it.

### Tasks

1. **Content addressing** (`internal/saga/content.go`)
   - `ComputeCID(data []byte) ContentID` -- SHA-256 multihash
   - `ContentEnvelope`: data + metadata + publisher NodeID + Ed25519 signature
   - `VerifyEnvelope(env *ContentEnvelope) error` -- check hash and signature

2. **Intent protocol** (`internal/saga/intent.go`)
   - Message types: `WANT`, `FIND`, `PUBLISH`, `SUBSCRIBE`
   - `WANT(cid)`: request content by hash, returns `ContentEnvelope`
   - `FIND(service, query)`: discover service providers, returns `[]NodeID`
   - `PUBLISH(envelope)`: store CID in DHT, announce availability
   - `SUBSCRIBE(topic)`: register for updates on a topic

3. **Content cache** (`internal/saga/cache.go`)
   - LRU cache of `ContentEnvelope` keyed by CID
   - Configurable max entries (default: 1000)
   - Thread-safe via `sync.RWMutex`

4. **Service registry** (`internal/saga/service.go`)
   - Register: write `ServiceRecord` to DHT keyed by service name
   - Lookup: query DHT for service name, return provider list
   - Basic load balancing: random selection from providers

5. **Integration test:** Node A publishes content, Node C retrieves it via Node B (who cached it)

---

## Phase 5: Rune (Trust Layer)

**Deliverable:** Nodes can attest to each other's identity and issue capability tokens.

### Tasks

1. **Attestations** (`internal/rune/attestation.go`)
   - `Attestation` struct: subject, attester, claim, confidence, expiry, signature
   - `CreateAttestation(subject NodeID, claim string, confidence float64) *Attestation`
   - `VerifyAttestation(att *Attestation) error`
   - In-memory attestation store with query by subject

2. **Capability tokens** (`internal/rune/capability.go`)
   - `Capability` struct: issuer, holder, resource, actions, expiry, delegatable, signature
   - `GrantCapability(holder NodeID, resource string, actions []string) *Capability`
   - `VerifyCapability(cap *Capability, action string) error`

3. **Trust computation** (`internal/rune/reputation.go`)
   - `ComputeTrust(target NodeID) float64`
   - Walk attestation graph with transitive decay
   - Simple reputation: count of positive attestations from known peers

4. **Integration test:** Alice attests Bob, Carol derives transitive trust in Bob via Alice

---

## Phase 6: Realm (Application Layer)

**Deliverable:** Application-level primitives working end-to-end.

### Tasks

1. **P2P RPC** (`internal/realm/rpc.go`)
   - Register service handlers: `RegisterService(name string, handler RPCHandler)`
   - Call remote: `Call(nodeID NodeID, service string, method string, args []byte) ([]byte, error)`
   - Discovery via Saga FIND, connection via Veil

2. **Pub/Sub** (`internal/realm/pubsub.go`)
   - `Publish(topic string, data []byte) error`
   - `Subscribe(topic string, handler func(data []byte)) error`
   - Direct broadcast to all known subscribers (PoC simplification)

3. **Basic CRDT** (`internal/realm/crdt.go`)
   - Last-Writer-Wins Register: `{Value, Timestamp, NodeID}`
   - `Set(key string, value []byte)` / `Get(key string) []byte`
   - Sync: exchange register states, highest timestamp wins
   - Demonstrates conflict-free replication

4. **Integration test:** Full chat scenario -- discover chat service, connect, exchange messages, pub/sub room updates

---

## Phase 7: Daemon & API

**Deliverable:** A single Go binary that runs N nodes and exposes HTTP/WebSocket API.

### Tasks

1. **CLI entry point** (`cmd/valhalla/main.go`)
   - Flags: `--port`, `--bootstrap`, `--demo`, `--nodes`
   - `--demo` mode: start 6 nodes, API server, serve embedded UI
   - Signal handling for graceful shutdown via `context.Context`

2. **REST API** (`internal/api/server.go`)
   - `net/http` with `http.ServeMux`
   - Endpoints per the PoC design doc
   - CORS headers for dev mode
   - JSON encoding via `encoding/json`

3. **WebSocket event stream** (`internal/api/events.go`)
   - Fan-out: aggregate `StackEvent` channels from all nodes
   - Send to all connected WebSocket clients
   - Drop-oldest buffering for slow consumers

4. **Demo scenarios** (`internal/demo/scenarios.go`)
   - Each scenario is a `func(ctx context.Context, net *Network) error`
   - Scenario emits narration events alongside stack events
   - Implement all 6 scenarios from the design doc

5. **Embedded UI**
   ```go
   //go:embed ui/dist/*
   var uiFiles embed.FS
   // Serve at root: http.FileServer(http.FS(uiFiles))
   ```

6. **Multi-node orchestrator** (`internal/demo/network.go`)
   - `NewNetwork(count, basePort)` -- create and connect N nodes
   - `SetLatency`, `Disconnect`, `Migrate` for scenario control

---

## Phase 8: UI (React + TypeScript)

**Deliverable:** Web UI with network visualization and demo scenarios.

Can begin in parallel with Phase 4+ once the API shape (Phase 7) is defined. Use mock data initially.

### Tasks

1. **App shell** (`ui/src/App.tsx`)
   - Main layout: sidebar + main panel
   - Design tokens and theming (`theme.ts`)

2. **WebSocket hook** (`ui/src/hooks/useValhalla.ts`)
   - Connect to `ws://localhost:8080/api/events`
   - Parse `StackEvent` JSON, dispatch to Zustand store
   - Auto-reconnect on disconnect

3. **Network topology** (`ui/src/components/NetworkGraph.tsx`)
   - D3 force-directed layout
   - Nodes as circles with short NodeID labels
   - Edges as connections with animated packet flow

4. **Stack visualization** (`ui/src/components/StackView.tsx` + `LayerActivityBar.tsx`)
   - 6-layer vertical stack diagram
   - Highlight active layer during packet processing
   - Per-layer activity indicator bars
   - Show data transformation at each layer

5. **Event log** (`ui/src/components/EventLog.tsx`)
   - Real-time stream of stack events from all nodes
   - Filterable by layer and event type

6. **Demo runner** (`ui/src/components/DemoRunner.tsx` + `ScenarioCard.tsx`)
   - Scenario cards with descriptions
   - Scenario-specific visualizations (`ScenarioViz.tsx`)
   - Narration timeline synced with events (`NarrationTimeline.tsx`)

7. **Trust graph** (`ui/src/components/TrustGraph.tsx`)
   - Directed graph of attestations
   - Edge labels: claim + confidence
   - Node labels: computed trust scores

8. **State management** (`ui/src/store/useValhallaStore.ts`)
   - Zustand store for network state, events, scenario progress
   - Type-safe selectors and actions

---

## Phase 9: Polish & Integration

**Deliverable:** Everything works end-to-end with a smooth demo experience.

### Tasks

1. **End-to-end testing**
   - `go test ./...` covers all layers
   - Run all 6 demo scenarios in CI
   - Verify API responses match expected format

2. **Performance check**
   - `go test -bench` for crypto and framing hot paths
   - Verify UI maintains 60fps during active demos
   - Profile with `pprof` if needed

3. **Error handling**
   - Graceful degradation when nodes disconnect
   - Clear error messages in UI and API responses

4. **One-command demo**
   ```bash
   make build      # builds UI, embeds in Go binary
   ./bin/valhalla --demo
   # → Starts 6 nodes on ports 9001-9006
   # → API + UI server on :8080
   # → Open http://localhost:8080
   ```

---

## Dependency Graph

```
Phase 0 (Scaffolding)
    │
    v
Phase 1 (Bifrost) ──────────────────────────────┐
    │                                             │
    v                                             │
Phase 2 (Yggdrasil)                               │
    │                                             │
    v                                             │
Phase 3 (Veil)                                    │
    │                                             │
    v                                             │
Phase 4 (Saga)                              Phase 8 (UI)
    │                                        can start once
    v                                        API shape is
Phase 5 (Rune)                               defined (Phase 7
    │                                        types), uses
    v                                        mock data first
Phase 6 (Realm)                                   │
    │                                             │
    v                                             │
Phase 7 (Daemon/API) ────────────────────────────┘
    │
    v
Phase 9 (Polish)
```

---

## Key Technical Risks

| Risk | Mitigation |
|------|------------|
| Noise handshake correctness | Use `flynn/noise` (production-proven in Nebula), test against Noise test vectors |
| DHT routing in small networks | Simplify to direct peer exchange for < 20 nodes. Full Kademlia is overkill for PoC |
| WebSocket backpressure | Buffer events with drop-oldest policy for slow UI consumers |
| UI performance with many events | Throttle event dispatch in Zustand store, batch React renders |
| Goroutine leaks | Use `context.Context` everywhere, `goleak` in tests |
| Race conditions | Run tests with `-race` flag throughout development |
| Scope creep | Strictly follow PoC simplifications table. Resist adding features |

---

## Success Criteria

The PoC is successful when:

1. **6 nodes form a mesh** and can route messages to any other node by NodeID
2. **All communication is encrypted** -- a wire-level observer sees only ciphertext
3. **Content addressing works** -- publish by hash, retrieve from any peer holding it
4. **Identity survives mobility** -- a node can change its listen address without breaking connections
5. **The UI tells the story** -- a non-technical viewer can understand what's different about Valhalla by watching the demos
6. **One command to demo** -- `./bin/valhalla --demo` and it works
