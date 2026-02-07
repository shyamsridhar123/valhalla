# Valhalla

**A post-IP networking stack built from scratch in Go.**

Valhalla replaces OSI layers 2–7 with six new layers designed around cryptographic identity, content addressing, and mandatory encryption. No DNS. No CAs. No IP addresses. Every node is identified by its Ed25519 keypair.

```
 Traditional OSI              Valhalla Stack
 ─────────────               ──────────────
 7. Application    ──────►   6. Realm       (P2P RPC, Pub/Sub, CRDTs)
 6. Presentation              5. Rune       (Web-of-trust, capabilities)
 5. Session        ──────►   4. Saga       (Content addressing, discovery)
 4. Transport      ──────►   3. Veil       (Always-on encryption, multiplexing)
 3. Network        ──────►   2. Yggdrasil  (Kademlia DHT, mesh routing)
 2. Data Link      ──────►   1. Bifrost    (Framing over TCP/WS/UDP)
 1. Physical                  0. Physical   (Unchanged)
```

## What This Actually Does

- **Bifrost** — Frames and tunnels over existing transports (TCP, WebSocket, UDP)
- **Yggdrasil** — Ed25519 identity, Kademlia k-bucket routing, DHT peer discovery
- **Veil** — Noise protocol handshake, ChaCha20-Poly1305 encryption, stream multiplexing
- **Saga** — Content-addressed data (SHA-256 CIDs), intent-based service discovery
- **Rune** — Decentralized trust via signed attestations and capability tokens
- **Realm** — Application layer with P2P RPC, topic-based pub/sub, LWW-Register CRDTs

## Quick Start

```bash
# Build (requires Go 1.24+, Node 18+)
make build

# Run demo — spins up 6 nodes with a React UI on :8080
./bin/valhalla --demo
```

The demo launches a 6-node mesh and opens a browser UI showing:
- Live network topology (D3 force-directed graph)
- Per-node 6-layer stack visualization
- Packet flow animations across the mesh
- Trust graph with transitive reputation scores
- Content explorer with publish/subscribe

## Architecture

```
cmd/valhalla/          CLI + embedded UI (go:embed)
internal/
  bifrost/             Layer 1 — Frame encoding, TCP/WS transports
  yggdrasil/           Layer 2 — Identity, peer table, DHT, routing
  veil/                Layer 3 — Noise handshake, encryption, streams
  saga/                Layer 4 — Content addressing, intents, cache
  rune/                Layer 5 — Attestations, capabilities, reputation
  realm/               Layer 6 — RPC, pub/sub, CRDT sync
  api/                 REST API + WebSocket event streaming
  demo/                Multi-node demo orchestrator
  node/                Full-stack node assembly
  types/               Shared types (NodeID, ContentID, PathAddr, frames)
ui/                    React 18 + TypeScript + Vite + D3 + Zustand
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Core | Go 1.24, goroutines, stdlib net |
| Crypto | Ed25519, Noise XX (flynn/noise), ChaCha20-Poly1305, HKDF |
| Transport | TCP, WebSocket (nhooyr.io/websocket) |
| Routing | Kademlia DHT, XOR distance, k-buckets |
| Frontend | React 18, TypeScript, Vite, D3.js, Zustand, Framer Motion |
| Deployment | Single binary via `go:embed` |

## Development

```bash
make test          # Run tests with race detector
make bench         # Benchmarks (framing, types)
make dev           # Dev mode — Go backend + Vite HMR
make clean         # Clean build artifacts
```

## Why "Valhalla"?

Each layer is named after Norse mythology:
- **Bifrost** — The rainbow bridge between worlds (bridges old and new networks)
- **Yggdrasil** — The world tree connecting all realms (mesh connecting all nodes)
- **Veil** — The shroud over all communication (encryption)
- **Saga** — Stories that persist beyond their teller (content-addressed data)
- **Rune** — Inscriptions of power and authority (trust and capabilities)
- **Realm** — The world built on top (applications)

## Disclaimer

**This is an experimental proof-of-concept.** It is not production-ready, not audited, and not suitable for any security-critical use. The cryptographic implementations have not been reviewed. Use at your own risk.

## License

[MIT](LICENSE)
