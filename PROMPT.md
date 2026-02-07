# Valhalla PoC — Full Build Prompt

Implement the COMPLETE Valhalla PoC, working through all 10 phases (0-9) sequentially.

## Instructions

Each iteration:
1. Run `bd list --status=in_progress` and `bd ready` to see current state
2. Check what code exists already (look at internal/ and ui/ directories)
3. Continue from where you left off — pick up the next incomplete task
4. Use `bd update <id> --status=in_progress` before starting a task
5. Use `bd close <id>` when done with a task
6. Run `go test -race ./...` after completing each phase
7. Commit working code after each completed phase
8. Run `bd sync` after closing issues

## Rules

- Follow architecture in docs/01-architecture.md and docs/02-poc-design.md exactly
- Follow Go idioms from .agents/skills/golang-pro/
- Follow security patterns from .agents/skills/sharp-edges/
- Use table-driven tests per .agents/skills/golang-testing/
- For React UI, follow .agents/skills/vercel-react-best-practices/
- For Zustand stores, follow .agents/skills/zustand-state-management/

## Phase 0: Project Scaffolding (epic: valhalla-snu)

| Task ID | Description |
|---------|-------------|
| valhalla-1fv | go mod init github.com/valhalla/valhalla, dirs, Makefile |
| valhalla-onl | internal/types/types.go — NodeID, ContentID, PathAddr, BifrostFrame, StackEvent |
| valhalla-3b3 | go get golang.org/x/crypto github.com/flynn/noise nhooyr.io/websocket |
| valhalla-476 | Initialize React UI with Vite (react-ts), install d3 @xyflow/react zustand framer-motion |
| valhalla-6ch | Smoke test — two goroutines exchange message over TCP |

## Phase 1: Bifrost — Bridge Layer (epic: valhalla-t7p)

| Task ID | Description |
|---------|-------------|
| valhalla-gal | internal/bifrost/frame.go — encode/decode, magic 0x56 0x48, length prefix, frame types |
| valhalla-5re | internal/bifrost/transport.go — Transport + Conn interfaces |
| valhalla-04t | internal/bifrost/tcp.go — TCP transport with bufio |
| valhalla-vuj | internal/bifrost/ws.go — WebSocket transport |
| valhalla-q1r | Integration test — 1000 frames over TCP |

## Phase 2: Yggdrasil — Mesh Layer (epic: valhalla-1sk)

| Task ID | Description |
|---------|-------------|
| valhalla-52t | internal/yggdrasil/identity.go — Ed25519, NodeID=SHA256(pubkey) |
| valhalla-eqh | internal/yggdrasil/peertable.go — Kademlia k-buckets, XOR distance |
| valhalla-7jn | internal/yggdrasil/dht.go — Put/Get, iterative lookup |
| valhalla-ap3 | internal/yggdrasil/router.go — Route to NodeID, protocol messages |
| valhalla-606 | Bootstrap and peer discovery |
| valhalla-663 | Integration test — 6-node mesh routing |

## Phase 3: Veil — Encrypted Flow (epic: valhalla-6e4)

| Task ID | Description |
|---------|-------------|
| valhalla-acq | internal/veil/handshake.go — Noise XX via flynn/noise |
| valhalla-yig | internal/veil/crypto.go — ChaCha20-Poly1305, HKDF key derivation |
| valhalla-dye | internal/veil/stream.go — Stream multiplexing |
| valhalla-cac | internal/veil/connection.go — Connection manager, pooling |
| valhalla-ptg | Integration test — 10 concurrent encrypted streams |

## Phase 4: Saga — Intent/Content (epic: valhalla-s4y)

| Task ID | Description |
|---------|-------------|
| valhalla-zqt | internal/saga/content.go — ContentID, ContentEnvelope, verify |
| valhalla-mhr | internal/saga/intent.go — WANT/FIND/PUBLISH/SUBSCRIBE |
| valhalla-8zo | internal/saga/cache.go — LRU cache by CID |
| valhalla-s9u | internal/saga/service.go — Service registry via DHT |
| valhalla-7fj | Integration test — publish and retrieve via cache |

## Phase 5: Rune — Trust (epic: valhalla-z5w)

| Task ID | Description |
|---------|-------------|
| valhalla-a1r | internal/rune/attestation.go — Create/Verify attestations |
| valhalla-b0b | internal/rune/capability.go — Capability tokens |
| valhalla-ubq | internal/rune/reputation.go — Transitive trust computation |
| valhalla-dyv | Integration test — transitive trust |

## Phase 6: Realm — Application (epic: valhalla-c2p)

| Task ID | Description |
|---------|-------------|
| valhalla-s8k | internal/realm/rpc.go — P2P RPC framework |
| valhalla-sz8 | internal/realm/pubsub.go — Pub/Sub messaging |
| valhalla-9ki | internal/realm/crdt.go — LWW Register CRDT |
| valhalla-90x | Integration test — full chat scenario |

## Phase 7: Daemon & API (epic: valhalla-3fb)

| Task ID | Description |
|---------|-------------|
| valhalla-eo4 | cmd/valhalla/main.go — CLI flags, context shutdown |
| valhalla-im6 | internal/api/server.go — REST API endpoints |
| valhalla-00w | internal/api/events.go — WebSocket event fan-out |
| valhalla-mmf | internal/demo/scenarios.go — 6 demo scenarios |
| valhalla-14u | internal/demo/network.go — Multi-node orchestrator |
| valhalla-3o5 | Embedded UI via go:embed |

## Phase 8: React UI (epic: valhalla-bu3)

| Task ID | Description |
|---------|-------------|
| valhalla-eow | App.tsx — Main layout with tabs |
| valhalla-dyh | useValhalla.ts — WebSocket hook |
| valhalla-q6e | network.ts — Zustand store |
| valhalla-gn5 | NetworkGraph.tsx — D3 force-directed topology |
| valhalla-jo0 | StackView.tsx — 6-layer stack visualization |
| valhalla-c3b | PacketFlow.tsx — Packet animation |
| valhalla-15o | DemoRunner.tsx — Scenario runner UI |
| valhalla-8vt | ContentExplorer.tsx + TrustGraph.tsx |

## Phase 9: Polish (epic: valhalla-2rn)

| Task ID | Description |
|---------|-------------|
| valhalla-obu | End-to-end testing (all layers + demos) |
| valhalla-rju | Performance benchmarks |
| valhalla-5n9 | Error handling |
| valhalla-4x5 | One-command demo: make build && ./bin/valhalla --demo |

## Completion

Output `<promise>ALL PHASES COMPLETE</promise>` ONLY when ALL phases are done:
- `go test -race ./...` passes
- `make build` produces single binary
- `./bin/valhalla --demo` starts 6 nodes + UI on :8080
