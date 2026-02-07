# Technology Decision Record

## Decision: Go for Core Stack, React+TypeScript for UI

**Date:** 2026-02-06
**Status:** Accepted

---

## Context

Project Valhalla is a proof-of-concept reimagining of the network stack. The implementation language must support:
- Custom binary protocol framing and crypto
- Concurrent management of peer connections and layered protocol processing
- WebSocket bridge to a React visualization UI
- Simple deployment for demos (ideally single binary)
- Readable code that documents the architecture

Four languages were evaluated: Go, Rust, Python, TypeScript.

---

## Research Summary

### Evaluated Options

**Go**
- Stdlib crypto: `crypto/ed25519`, `crypto/ecdh` (X25519), `crypto/hkdf` (Go 1.24+)
- Noise: `flynn/noise` -- stable, all 15 standard patterns, used by Nebula in production
- Concurrency: goroutines + channels map 1:1 to layered stack architecture
- DHT: go-libp2p-kad-dht or custom (proven by go-ethereum, Syncthing)
- Deployment: single binary via `go:embed` with React UI baked in
- Reference projects: Nebula (overlay network, Noise, crypto identity), Tailscale (millions of users), WireGuard-go, go-ethereum, Syncthing
- External deps: 3 (`golang.org/x/crypto`, `flynn/noise`, `nhooyr.io/websocket`)
- Ed25519 verify: ~30,000-50,000 ops/sec

**Rust**
- Crypto: `ed25519-dalek` (audited by Quarkslab), `ring` (BoringSSL lineage, 400M downloads)
- Noise: `snow` -- 18.4M downloads, all patterns + PSK + HFS
- Concurrency: tokio async + channels, more boilerplate than Go goroutines
- DHT: rust-libp2p (powers Polkadot, Lighthouse/Ethereum consensus)
- Deployment: single binary, WASM compilation to browser (200KB-1MB)
- Reference projects: Iroh ("dial keys not IPs"), Polkadot, BoringTun (Cloudflare), Nym mixnet
- External deps: 5-8 crates
- Ed25519 verify: ~70,000-90,000 ops/sec
- Learning curve: steep, 2-4 week ramp-up for protocol async code

**Python**
- Crypto: C bindings (PyNaCl → libsodium, `cryptography` → OpenSSL), near-native speed
- Noise: `dissononce` -- all patterns, dormant since 2019
- Concurrency: asyncio, single-threaded, adequate for PoC
- DHT: `kademlia` package (production-stable, asyncio-native)
- Deployment: Docker compose or PyInstaller (50-100MB, platform-specific)
- Reference projects: Tribler (20 years), Magic Wormhole
- Fastest iteration: ~1,000-2,000 lines for full PoC
- Ed25519 verify: ~40,000-71,000 ops/sec (C bindings)

**TypeScript (Node.js/Bun)**
- Crypto: `@noble/*` (audited 6 times, pure JS), 14x slower than native
- Noise: `@chainsafe/libp2p-noise` -- production-grade, XX pattern
- Concurrency: event loop, single-threaded, worker threads for crypto
- DHT: js-libp2p or Hyperswarm (both mature)
- Shared types with React UI saves ~2-5 days vs codegen approach
- Reference projects: Helia (IPFS), WebTorrent, Hyperswarm
- Ed25519 verify: ~1,280 ops/sec (pure JS)

### Elimination

- **Python**: Dormant Noise library, Docker-only deployment, no path beyond PoC.
- **TypeScript**: 14x slower crypto, verbose binary manipulation, no single-binary deployment. Shared types advantage (~2-5 days) does not justify weaker systems primitives.

### Go vs Rust (the real decision)

| Factor | Go | Rust | Winner for PoC |
|--------|-----|------|----------------|
| Time to working demo | ~3-5K lines, fast compile | ~5-10K lines, slower compile | Go |
| Concurrency ↔ stack layers | Goroutines + channels = natural 1:1 | tokio tasks, more ceremony | Go |
| Type safety for protocols | Weak (no sum types) | Excellent (exhaustive enums) | Rust |
| Browser WASM node | Not practical (10-16MB) | Excellent (200KB-1MB) | Rust |
| External dependencies | 3 | 5-8 | Go |
| Code readability as docs | High (reads like pseudocode) | Medium (lifetimes, generics) | Go |
| Path to production | Strong (Tailscale proves it) | Strongest (zero-cost, no GC) | Rust |
| Directly relevant reference | Nebula (Go overlay + Noise) | Iroh (key-addressed P2P) | Tie |

---

## Decision

**Go for core stack + daemon. React + TypeScript for UI.**

### Rationale

1. **Nebula validates the approach.** A production Go overlay network built on `flynn/noise` with cryptographic identity proves every major technical bet.

2. **Goroutines map to the architecture.** Each Valhalla layer becomes a goroutine pipeline connected by typed channels. The code is the architecture diagram.

3. **Minimal dependencies.** Go's stdlib provides ed25519, X25519, HKDF. Three external packages cover everything else.

4. **Single-binary deployment.** `go:embed` bakes the React UI into the Go binary. `./valhalla --demo` runs everything.

5. **The PoC communicates, not performs.** Go's readability serves the goal of demonstrating the architecture to technical reviewers.

### Trade-offs Accepted

- No exhaustive enum matching for protocol states (mitigated by tests)
- No browser WASM node (mitigated by WebSocket bridge to UI)
- Weaker type system for protocol messages (mitigated by careful struct design)
- GC pauses under extreme load (irrelevant for PoC scale of 6-20 nodes)

### Future: When to Switch to Rust

If Valhalla moves beyond PoC to a production overlay network:
- Rewrite core stack in Rust using Iroh's architecture as reference
- Use `snow` for Noise, `quinn` for QUIC transport, rust-libp2p components for DHT
- Compile core to WASM for browser-native nodes
- Protocol design proven in Go translates directly to Rust

---

## Final Stack

```
Core Stack + Daemon (Go)
├── crypto/ed25519              (stdlib, identity)
├── crypto/ecdh                 (stdlib, X25519 key exchange)
├── crypto/hkdf                 (stdlib, key derivation)
├── golang.org/x/crypto         (chacha20poly1305, nacl, blake2)
├── github.com/flynn/noise      (Noise protocol handshake)
├── nhooyr.io/websocket         (WebSocket for UI bridge)
└── net/http                    (stdlib, REST API)

UI (React + TypeScript)
├── React 19                    (component framework)
├── D3.js or @xyflow/react      (network topology visualization)
├── Framer Motion               (packet flow animation)
└── Zustand                     (state management)

Build & Deploy
├── go build                    (single binary, embeds UI)
├── Vite                        (UI build)
└── ./valhalla --demo           (one command to run everything)
```
