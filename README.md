<p align="center">
  <strong>⚡ Valhalla</strong><br>
  <em>A post-IP networking stack built from scratch in Go</em>
</p>

---

Valhalla replaces OSI layers 2–7 with six new layers designed around cryptographic identity, content addressing, and mandatory encryption. No DNS. No CAs. No IP addresses. Every node is identified by its Ed25519 keypair.

```
    Traditional OSI                                   Valhalla Stack
   ┌─────────────────┐                    ┌──────────────────────────────────────┐
   │ 7  Application  │  ───────────────►  │ 6  Realm       P2P RPC, Pub/Sub,     │
   │ 6  Presentation │                    │                CRDTs                 │
   ├─────────────────┤                    ├──────────────────────────────────────┤
   │ 5  Session      │  ───────────────►  │ 5  Rune        Web-of-trust,         │
   │                 │                    │                capabilities          │
   ├─────────────────┤                    ├──────────────────────────────────────┤
   │ 4  Transport    │  ───────────────►  │ 4  Saga        Content addressing,   │
   │                 │                    │                intent discovery      │
   ├─────────────────┤                    ├──────────────────────────────────────┤
   │ 3  Network      │  ───────────────►  │ 3  Veil        Always-on encryption, │
   │                 │                    │                stream multiplexing   │
   ├─────────────────┤                    ├──────────────────────────────────────┤
   │ 2  Data Link    │  ───────────────►  │ 2  Yggdrasil   Kademlia DHT,         │
   │                 │                    │                mesh routing          │
   ├─────────────────┤                    ├──────────────────────────────────────┤
   │ 1  Physical     │                    │ 1  Bifrost     Framing over          │
   └─────────────────┘                    │                TCP / WS / UDP        │
                                          ├──────────────────────────────────────┤
                                          │ 0  Physical    Unchanged             │
                                          └──────────────────────────────────────┘
```

## Stack Layers

| # | Layer | Codename | Purpose |
|---|-------|----------|---------|
| 6 | Application | **Realm** | P2P RPC, topic-based pub/sub, LWW-Register CRDTs |
| 5 | Trust | **Rune** | Decentralized trust via signed attestations and capability tokens |
| 4 | Content | **Saga** | Content-addressed data (SHA-256 CIDs), intent-based service discovery |
| 3 | Encryption | **Veil** | Noise protocol handshake, ChaCha20-Poly1305, stream multiplexing |
| 2 | Mesh | **Yggdrasil** | Ed25519 identity, Kademlia k-bucket routing, DHT peer discovery |
| 1 | Bridge | **Bifrost** | Frames and tunnels over existing transports (TCP, WebSocket, UDP) |

## Quick Start

```bash
# Prerequisites: Go 1.24+, Node 18+

make build                # Build single binary (Go + embedded React UI)
./bin/valhalla --demo     # Start 6-node mesh with web UI on :8080
```

The demo launches a 6-node mesh and opens a browser UI at **http://localhost:8080** showing:

- **Network topology** — D3 force-directed graph of live mesh connections
- **Stack visualization** — Per-node 6-layer activity with real-time event flow
- **Scenario runner** — Guided demos with narration timeline
- **Trust graph** — Attestation network with transitive reputation scores

## Project Structure

```
cmd/valhalla/                CLI entry point + embedded UI (go:embed)
internal/
├── bifrost/                 Layer 1 — Frame encoding, TCP/WS transports
├── yggdrasil/               Layer 2 — Identity, peer table, DHT, routing
├── veil/                    Layer 3 — Noise handshake, encryption, streams
├── saga/                    Layer 4 — Content addressing, intents, cache
├── rune/                    Layer 5 — Attestations, capabilities, reputation
├── realm/                   Layer 6 — RPC, pub/sub, CRDT sync
├── api/                     REST API + WebSocket event streaming
├── demo/                    Multi-node orchestrator + demo scenarios
├── node/                    Full-stack node assembly
└── types/                   Shared types (NodeID, ContentID, PathAddr, frames)
ui/                          React 19 + TypeScript + Vite + D3.js + Zustand
├── src/components/          NetworkGraph, StackView, TrustGraph, DemoRunner, ...
├── src/hooks/               useValhalla (WebSocket hook)
├── src/store/               Zustand state management
└── src/utils/               D3 helpers
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Core | Go 1.24 — goroutines, stdlib `net`, `crypto` |
| Crypto | Ed25519, Noise XX ([flynn/noise](https://github.com/flynn/noise)), ChaCha20-Poly1305, HKDF |
| Transport | TCP, WebSocket ([nhooyr.io/websocket](https://github.com/nhooyr/websocket)) |
| Routing | Kademlia DHT, XOR distance, k-buckets |
| Frontend | React 19, TypeScript, Vite, D3.js, Zustand, Framer Motion |
| Deployment | Single binary via `go:embed` |

> **External Go dependencies: 3** — `golang.org/x/crypto`, `flynn/noise`, `nhooyr.io/websocket`. Everything else is stdlib.

## Development

```bash
make test      # Run all tests with race detector
make bench     # Benchmarks (framing, types)
make dev       # Dev mode — Go backend + Vite HMR
make build     # Production build → ./bin/valhalla
make clean     # Clean build artifacts
```

## Demo Scenarios

| Scenario | Description |
|----------|-------------|
| Mesh Formation | 6 nodes discover each other and form a mesh network |
| Encrypted Chat | Two nodes establish encrypted communication and exchange messages |
| Content Sharing | Content published by one node is discovered and retrieved by another |
| Trust Web | Nodes build a web of trust through attestations |
| Service Discovery | A node discovers and connects to a service provided by another node |
| State Sync | Nodes synchronize shared state using CRDTs |

## Naming

Each layer is named after Norse mythology:

| Layer | Name | Meaning |
|-------|------|---------|
| 1 | **Bifrost** | The rainbow bridge between worlds — bridges old and new networks |
| 2 | **Yggdrasil** | The world tree connecting all realms — mesh connecting all nodes |
| 3 | **Veil** | The shroud over all communication — encryption |
| 4 | **Saga** | Stories that persist beyond their teller — content-addressed data |
| 5 | **Rune** | Inscriptions of power and authority — trust and capabilities |
| 6 | **Realm** | The world built on top — applications |

## Documentation

Detailed design documents are in [`docs/`](docs/):

- [Vision & Motivation](docs/00-vision.md) — What's wrong with the current internet stack
- [Architecture](docs/01-architecture.md) — Full 6-layer stack design with wire formats
- [PoC Design](docs/02-poc-design.md) — Technical design for the proof of concept
- [Implementation Plan](docs/03-implementation-plan.md) — Phased build plan
- [Tech Decisions](docs/04-tech-decision.md) — Why Go, why these dependencies

## Disclaimer

> **This is an experimental proof-of-concept.** It is not production-ready, not audited, and not suitable for any security-critical use. The cryptographic implementations have not been reviewed. Use at your own risk.

## License

[MIT](LICENSE)
