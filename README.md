<p align="center">
  <strong>⚡ Valhalla</strong><br>
  <em>An overlay network protocol stack built in Go</em>
</p>

---

Valhalla is a **6-layer overlay network stack** that runs on top of existing TCP/IP infrastructure. It implements cryptographic identity, content addressing, and mandatory encryption as an application-level protocol suite — similar in approach to [libp2p](https://libp2p.io/), [Yggdrasil Network](https://yggdrasil-network.github.io/), or [Tailscale](https://tailscale.com/).

Every node is identified by its Ed25519 keypair (not IP addresses). There is no DNS or Certificate Authority dependency. All communication is encrypted by default.

> **Important:** Valhalla does not replace the OS TCP/IP stack. It builds a new protocol stack *above* it. The six Valhalla layers are application-level abstractions that handle identity, routing, encryption, content addressing, trust, and application services within the overlay. The underlying OS kernel still handles actual L1–L4 networking (Ethernet, IP, TCP). Think of it as a "network stack within the application layer" — the same architectural pattern used by Tor, I2P, and libp2p.

```
                              Valhalla Overlay Stack
                    ┌──────────────────────────────────────┐
                    │ 6  Realm       P2P RPC, Pub/Sub,     │
                    │                CRDTs                 │
                    ├──────────────────────────────────────┤
                    │ 5  Rune        Web-of-trust,         │
                    │                capabilities          │
                    ├──────────────────────────────────────┤
                    │ 4  Saga        Content addressing,   │
                    │                intent discovery      │
                    ├──────────────────────────────────────┤
                    │ 3  Veil        Always-on encryption, │
                    │                stream multiplexing   │
                    ├──────────────────────────────────────┤
                    │ 2  Yggdrasil   Kademlia DHT,         │
                    │                mesh routing          │
                    ├──────────────────────────────────────┤
                    │ 1  Bifrost     Framing over          │
                    │                TCP / WS / UDP        │
                    ╞══════════════════════════════════════╡
                    │    OS TCP/IP   Actual L1-L4          │
                    │    Stack       (unchanged)           │
                    └──────────────────────────────────────┘
```

## Stack Layers

Each layer is an application-level abstraction. The numbering is internal to Valhalla and does not correspond to OSI layer numbers (e.g., Bifrost is labeled "Layer 1" but operates above the OS transport layer, not at the physical layer).

| # | Layer | Codename | What It Does |
|---|-------|----------|--------------|
| 6 | Application | **Realm** | P2P RPC, topic-based pub/sub, LWW-Register CRDTs |
| 5 | Trust | **Rune** | Decentralized trust via signed attestations and capability tokens |
| 4 | Content | **Saga** | Content-addressed data (SHA-256 CIDs), intent-based service discovery |
| 3 | Encryption | **Veil** | Noise protocol handshake, ChaCha20-Poly1305, stream multiplexing |
| 2 | Mesh | **Yggdrasil** | Ed25519 identity, Kademlia k-bucket routing, DHT peer discovery |
| 1 | Bridge | **Bifrost** | Frames and tunnels over existing transports (TCP, WebSocket, UDP) |

### Relationship to OSI

Valhalla's layers are **conceptually inspired** by the OSI model but do not replace it. In OSI terms, the entire Valhalla stack runs at Layer 7 (Application). Within that, Valhalla decomposes concerns that traditional networking spreads across layers — identity, encryption, routing, content addressing — into its own layered abstraction. This is the same pattern used by libp2p, Tor, and CJDNS.

## Quick Start

```bash
# Prerequisites: Go 1.24+, Node 18+

cd ui && npm install      # Install frontend dependencies (first time only)
cd ..
make build                # Build single binary (Go + embedded React UI)
./bin/valhalla --demo     # Start 6-node mesh with web UI on :8080
```

Open **http://localhost:8080** — the UI is embedded in the binary. The demo shows:

- **Network topology** — D3 force-directed graph of live mesh connections
- **Stack visualization** — Per-node 6-layer activity with real-time event flow
- **Scenario runner** — Guided demos with narration timeline and interactive sandbox

## Project Structure

```
cmd/valhalla/                CLI entry point + embedded UI (go:embed)
internal/
├── bifrost/                 Bridge — Frame encoding, TCP/WS transports
├── yggdrasil/               Mesh — Identity, peer table, DHT, routing
├── veil/                    Encryption — Noise handshake, encrypted streams
├── saga/                    Content — Content addressing, intents, cache
├── rune/                    Trust — Attestations, capabilities, reputation
├── realm/                   Application — RPC, pub/sub, CRDT sync
├── api/                     REST API + WebSocket event streaming
├── demo/                    Multi-node orchestrator + demo scenarios
├── node/                    Full-stack node assembly
└── types/                   Shared types (NodeID, ContentID, PathAddr, frames)
ui/                          React 19 + TypeScript + Vite + D3.js + Zustand
├── src/components/          NetworkGraph, StackView, DemoRunner, ApiDocs, ...
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
make ui-install  # Install frontend deps (first time)
make dev         # Dev mode — Go API on :8080 + Vite HMR on :5173
make build       # Production build → ./bin/valhalla (UI embedded)
make test        # Run all tests with race detector
make bench       # Benchmarks (framing, types)
make clean       # Clean build artifacts
```

In dev mode, open **http://localhost:5173** — Vite proxies API calls to the Go backend on `:8080`.

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

## How It Works

In the current PoC, all Valhalla nodes run as goroutines within a single process. The demo mode uses in-memory connections between nodes (no actual TCP traffic between them). This makes the demo deterministic and easy to run, but it means the "network" is simulated within the application.

When running in non-demo mode, nodes communicate over real TCP/WebSocket connections — but these ride on the OS TCP/IP stack. Valhalla adds its own framing (Bifrost), routing (Yggdrasil), encryption (Veil), and higher-level services on top.

## Comparable Projects

| Project | Similarity | Key Difference |
|---------|-----------|----------------|
| [libp2p](https://libp2p.io/) | Modular network stack, crypto identity, DHT | Production-grade, IPFS ecosystem |
| [Yggdrasil Network](https://yggdrasil-network.github.io/) | Overlay mesh, crypto addressing, DHT routing | Uses TUN interface for real IP replacement |
| [CJDNS](https://github.com/cjdelisle/cjdns) | Crypto identity as address, mesh routing | Operates at Layer 3 via TUN device |
| [Tailscale](https://tailscale.com/) | WireGuard overlay, crypto identity | Production VPN, centralized coordination |
| [I2P](https://geti2p.net/) | Layered overlay, encrypted transport | Focus on anonymity, garlic routing |

## Disclaimer

> **This is an experimental proof-of-concept.** It demonstrates overlay network architecture concepts through a working simulation. It is not production-ready, not audited, and not suitable for any security-critical use. The cryptographic implementations have not been reviewed. The demo network runs in-memory within a single process. Use at your own risk.

## License

[MIT](LICENSE)
