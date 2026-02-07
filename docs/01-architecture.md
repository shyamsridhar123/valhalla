# The Valhalla Stack: Architecture

## Stack Overview

The Valhalla stack replaces OSI layers 2-7 with six new layers designed around cryptographic identity, content addressing, and mandatory security.

```
 OSI Model                          Valhalla Stack
 ──────────                         ──────────────
 ┌─────────────────┐                ┌─────────────────┐
 │  7. Application  │                │  6. Realm       │  Application services
 ├─────────────────┤                │     (App Mesh)  │  P2P services, CRDT sync
 │  6. Presentation │                ├─────────────────┤
 ├─────────────────┤                │  5. Rune        │  Trust, capabilities,
 │  5. Session      │                │     (Trust)     │  reputation, attestation
 ├─────────────────┤                ├─────────────────┤
 │  4. Transport    │                │  4. Saga        │  Content addressing,
 ├─────────────────┤                │     (Intent)    │  service discovery, schema
 │  3. Network      │                ├─────────────────┤
 ├─────────────────┤                │  3. Veil        │  Encrypted streams,
 │  2. Data Link    │                │     (Flow)      │  multiplexing, multi-path
 ├─────────────────┤                ├─────────────────┤
 │  1. Physical     │                │  2. Yggdrasil   │  Crypto identity, DHT
 │                  │                │     (Mesh)      │  routing, overlay network
 └─────────────────┘                ├─────────────────┤
                                    │  1. Bifrost     │  Framing & tunneling
                                    │     (Bridge)    │  over existing networks
                                    ├─────────────────┤
                                    │  0. Physical    │  Unchanged: wires,
                                    │                 │  fiber, radio
                                    └─────────────────┘
```

Each layer has a Norse-inspired codename reflecting its role:
- **Bifrost** (the rainbow bridge) -- bridges between the old internet and the new
- **Yggdrasil** (the world tree) -- connects all nodes in a unified mesh
- **Veil** -- the encrypted shroud over all communication
- **Saga** -- stories/data that persist and travel independent of their teller
- **Rune** -- inscriptions of trust and authority
- **Realm** -- the application world built on top

---

## Layer 1: Bifrost (Bridge)

**Purpose:** Tunnel Valhalla traffic over existing infrastructure.

Since we cannot replace physical networks, Bifrost provides framing and multiplexing over whatever transport is available -- TCP, UDP, QUIC, WebSocket, Bluetooth, or a USB cable.

### Design

```
┌────────────────────────────────┐
│         Bifrost Frame          │
├──────┬──────┬─────┬───────────┤
│ Magic│ Len  │Type │  Payload  │
│ 2B   │ 4B   │ 1B  │  Variable │
└──────┴──────┴─────┴───────────┘
```

- **Magic bytes** (`0x56 0x48`, "VH") -- identifies Valhalla frames
- **Length** -- payload size (up to 4GB, though MTU-aware fragmentation keeps frames small)
- **Type** -- frame type (DATA, CONTROL, KEEPALIVE, CLOSE)
- **Payload** -- the Yggdrasil packet

### Transports

Bifrost supports pluggable transports. Each transport implements a simple interface:

```
Transport:
  connect(address) -> BifrostConnection
  listen(address) -> Stream<BifrostConnection>

BifrostConnection:
  send(frame: BifrostFrame) -> void
  receive() -> BifrostFrame
  close() -> void
```

Initial transports for the PoC:
- **TCP** -- most reliable, works everywhere
- **WebSocket** -- enables browser nodes
- **UDP** -- for low-latency scenarios

### Self-Describing Addresses

Borrowing from libp2p's multiaddr concept, Bifrost uses **PathAddr** -- composable, self-describing address strings:

```
/tcp/192.168.1.5:9000              -- direct TCP
/ws/example.com:443                -- WebSocket
/udp/10.0.0.1:5000                 -- direct UDP
/tcp/relay.valhalla.net:9000/relay -- relayed connection
```

---

## Layer 2: Yggdrasil (Mesh)

**Purpose:** Cryptographic identity, peer discovery, and overlay routing.

This is the most radical departure from traditional networking. There are no IP addresses in the Valhalla address space. Every node is identified by a **NodeID** derived from its cryptographic keypair.

### Identity

Every node generates an Ed25519 keypair on first run:

```
private_key  = random_bytes(32)
public_key   = ed25519_derive_public(private_key)
node_id      = SHA-256(public_key)[0:32]  // 256-bit NodeID
```

The **NodeID** is the node's permanent identity. It:
- Is self-generated (no registration authority)
- Is self-authenticating (present the public key, anyone can verify the NodeID)
- Is location-independent (doesn't change when you move networks)
- Fits in 32 bytes (displayed as base58: `VH5dJk7Gx3nR9wQm...`)

### Peer Table

Each node maintains a **Peer Table** organized as Kademlia k-buckets:

```
┌─────────────────────────────────────────┐
│                Peer Table               │
├─────────┬───────────────────────────────┤
│ Bucket 0│ Peers at XOR distance [1, 2)  │  (closest)
│ Bucket 1│ Peers at XOR distance [2, 4)  │
│ Bucket 2│ Peers at XOR distance [4, 8)  │
│   ...   │          ...                  │
│Bucket255│ Peers at XOR distance [2^255, 2^256) │ (farthest)
├─────────┴───────────────────────────────┤
│ Each bucket holds up to k=20 entries    │
│ Entry: (NodeID, PublicKey, PathAddrs,   │
│         LastSeen, Latency, Reputation)  │
└─────────────────────────────────────────┘
```

**XOR distance:** `distance(A, B) = A XOR B`

This gives O(log n) lookup in a network of n nodes with O(log n) state per node.

### Routing

To route a message to a target NodeID:

```
1. Check local peer table for the target
2. If not found, find the k closest known peers to the target
3. Query those peers in parallel: "Who do you know closer to <target>?"
4. They respond with their closest known peers
5. Repeat until convergence (typically O(log n) hops)
6. The final peer either IS the target or knows its current PathAddr
```

### Peer Discovery

Nodes discover peers through multiple mechanisms:
- **Bootstrap nodes** -- hardcoded initial peers for joining the network
- **Local discovery** -- mDNS/broadcast on LAN to find nearby Valhalla nodes
- **DHT walk** -- random lookups to populate the peer table
- **Peer exchange** -- connected peers share their peer tables

### Location Resolution

The DHT stores `NodeID -> PathAddr[]` mappings. When a node's physical address changes (new WiFi, cellular, VPN), it publishes an updated signed record:

```
LocationRecord:
  node_id:     NodeID
  addresses:   PathAddr[]
  sequence:    uint64        // monotonically increasing
  timestamp:   uint64        // Unix milliseconds
  signature:   Ed25519Sig    // signs all above fields
```

Only the key holder can update their location. Observers can cache and relay these records. Stale records are superseded by higher sequence numbers.

---

## Layer 3: Veil (Flow)

**Purpose:** Encrypted, multiplexed, reliable communication streams.

Veil replaces TCP + TLS with a single layer that is always encrypted and supports multiple concurrent streams over a single connection.

### Connection Establishment

Veil uses the **Noise IK** handshake pattern (1-RTT when the initiator knows the responder's key, which is always true since the NodeID implies the key):

```
Initiator (I) knows Responder's (R) public key (from NodeID resolution)

  I -> R:  e, es, s, ss, payload    // Initiator's ephemeral key + encrypted static key + data
  R -> I:  e, ee, se, payload       // Responder's ephemeral key + encrypted data

After 1 round trip: mutual authentication + forward-secret encrypted channel
```

For **0-RTT** reconnection, peers who have previously connected can use a pre-shared key (PSK) derived from the previous session:

```
I -> R:  e, es, s, ss, psk, payload   // 0-RTT: first message carries application data
```

### Stream Multiplexing

A single Veil connection carries multiple independent streams:

```
┌──────────────────────────────────────┐
│            Veil Connection           │
│  ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │Stream #1│ │Stream #2│ │Stream#N│ │
│  │ (chat)  │ │ (file)  │ │(video) │ │
│  └─────────┘ └─────────┘ └────────┘ │
│                                      │
│  Single encrypted connection         │
│  No head-of-line blocking            │
│  Independent flow control per stream │
└──────────────────────────────────────┘
```

Each stream can be:
- **Reliable ordered** (like TCP) -- for messages, file transfer
- **Reliable unordered** -- for bulk data where order doesn't matter
- **Unreliable** (like UDP) -- for real-time audio/video, games
- **Unreliable ordered** -- for state snapshots where only latest matters

### Frame Format

```
┌─────────────────────────────────────┐
│           Veil Frame                │
├─────────┬────────┬─────┬───────────┤
│StreamID │ SeqNum │Flags│  Payload  │
│  4B     │  8B    │ 1B  │ Variable  │
├─────────┴────────┴─────┴───────────┤
│ Entire frame is encrypted (AEAD)   │
│ using ChaCha20-Poly1305            │
└─────────────────────────────────────┘

Flags:
  FIN       - stream close
  RST       - stream reset
  ACK       - acknowledgment
  RELIABLE  - requires acknowledgment
  PRIORITY  - priority bits (0-7)
```

### Multi-Path

Veil connections can span multiple physical paths simultaneously:

```
Node A ──── WiFi ────┐
                     ├──── Veil Connection ──── Node B
Node A ── Cellular ──┘

- Packets are scheduled across paths based on latency/bandwidth
- If one path fails, traffic shifts to remaining paths seamlessly
- The connection never breaks as long as at least one path works
```

### Congestion Control

Each stream has independent congestion control using a BBR-inspired algorithm. Streams on different paths have independent congestion state.

---

## Layer 4: Saga (Intent)

**Purpose:** Content addressing, service discovery, and structured data exchange.

Saga replaces DNS, HTTP semantics, and serialization with a unified intent-based system. Instead of "connect me to server X at address Y," you express "I want content Z" or "I need service W."

### Content Addressing

Every piece of content in Valhalla has a **ContentID** (CID):

```
CID = multihash(content)

multihash format:
  ┌──────────┬────────┬──────────────┐
  │ HashAlgo │ Length │  Hash Bytes  │
  │  1B      │  1B    │  Variable    │
  └──────────┴────────┴──────────────┘

Default: SHA-256 (algo=0x12, length=32)
```

Content signed by its publisher:

```
ContentEnvelope:
  cid:          ContentID
  data:         bytes
  publisher:    NodeID
  signature:    Ed25519Sig     // signs (cid + data)
  metadata:     Map<string, string>
  created_at:   uint64
```

The signature travels with the data. Anyone can verify it came from the claimed publisher. Caches, relays, and mirrors can serve it without being trusted.

### Intent Messages

Saga defines four fundamental operations:

```
WANT(cid: ContentID)
  "I want the content with this hash."
  Response: the ContentEnvelope, from whoever has it.

FIND(service: string, query: Map)
  "I need a service matching these criteria."
  Example: FIND("chat", {room: "general"})
  Response: list of NodeIDs offering this service.

PUBLISH(envelope: ContentEnvelope)
  "I am making this content available."
  Stored in the DHT, keyed by CID.

SUBSCRIBE(topic: string)
  "Notify me of new content on this topic."
  Pub/sub over the mesh.
```

### Service Registry

Nodes can register as service providers in the DHT:

```
ServiceRecord:
  service_name:  string          // e.g., "chat", "file-store", "compute"
  node_id:       NodeID
  capabilities:  Map<string, string>  // what this instance offers
  load:          float           // current load (0.0-1.0)
  version:       string
  signature:     Ed25519Sig
```

Clients discover services by name, get back a set of providers, and connect directly. No centralized registry. No DNS.

### Schema System

Saga uses a built-in schema system for structured data exchange (replacing the need for separate serialization formats):

```
schema ChatMessage {
  id:        bytes[32]     // ContentID
  author:    bytes[32]     // NodeID
  room:      string
  body:      string
  timestamp: uint64
  parent:    bytes[32]?    // optional, for threading
}
```

Schemas are themselves content-addressed. When two nodes communicate, they exchange schema CIDs and can verify they understand each other's data format.

---

## Layer 5: Rune (Trust)

**Purpose:** Decentralized trust, capability-based access control, and reputation.

Rune replaces the Certificate Authority hierarchy with a web-of-trust model and capability tokens.

### Identity Attestation

Instead of CAs, nodes vouch for each other:

```
Attestation:
  subject:     NodeID          // who is being vouched for
  attester:    NodeID          // who is vouching
  claim:       string          // what they're attesting (e.g., "is-human", "runs-service:chat")
  confidence:  float           // 0.0 to 1.0
  expires:     uint64          // Unix timestamp
  signature:   Ed25519Sig      // attester's signature
```

Trust is transitive with decay:
- If Alice trusts Bob (0.9) and Bob trusts Carol (0.8), Alice's derived trust in Carol = 0.9 * 0.8 * decay_factor
- Nodes maintain a local trust graph and compute trust scores for any peer on demand

### Capability Tokens

Access control uses **capability tokens** -- signed, delegatable permissions:

```
Capability:
  issuer:      NodeID          // who grants the capability
  holder:      NodeID          // who holds it (or "*" for bearer token)
  resource:    string          // what it grants access to
  actions:     string[]        // what actions are allowed
  constraints: Map             // additional constraints (time, count, etc.)
  delegatable: bool            // can the holder re-delegate?
  expires:     uint64
  signature:   Ed25519Sig
```

Example: Alice creates a capability granting Bob read access to her photos:
```
{
  issuer:    alice_node_id,
  holder:    bob_node_id,
  resource:  "/photos/*",
  actions:   ["read"],
  delegatable: false,
  expires:   1735689600000
}
```

Bob presents this token when requesting Alice's photos. No ACL server needed -- the token is self-contained and verifiable.

### Reputation

Nodes accumulate reputation through:
- **Uptime** -- reliably serving content and routing
- **Attestations** -- other nodes vouching for them
- **Contribution** -- bandwidth contributed to the mesh
- **Behavior** -- no spam, no attacks, valid routing

Reputation scores are local (each node computes its own view) but informed by the attestation graph. Sybil resistance comes from requiring attestation chains from trusted seeds.

---

## Layer 6: Realm (Application Mesh)

**Purpose:** Application-level services built natively on the Valhalla stack.

Realm provides the primitives applications need: RPC, pub/sub, state synchronization, and storage.

### Peer-to-Peer RPC

```
// Define a service
service FileStore {
  store(content: bytes) -> ContentID
  retrieve(cid: ContentID) -> bytes
  list(prefix: string) -> ContentID[]
}

// Call it -- the stack handles discovery, connection, encryption
let file_store = realm.find_service("FileStore")
let cid = await file_store.store(my_data)
```

### Pub/Sub

Topic-based publish/subscribe over the mesh using gossip:

```
// Publisher
realm.publish("news/tech", article_content)

// Subscriber
realm.subscribe("news/tech", (content) => {
  display(content)
})
```

Messages propagate via gossip through interested peers. No central broker.

### CRDT State Sync

For collaborative applications, Realm provides CRDT (Conflict-free Replicated Data Type) primitives:

```
// Create a shared document
let doc = realm.create_crdt("my-document", CRDTType.Text)

// Edit locally (works offline)
doc.insert(0, "Hello ")
doc.insert(6, "World")

// Changes automatically sync with all peers who have the document
// Conflicts are resolved automatically by CRDT merge rules
```

### Signed Append-Only Logs

Inspired by Secure Scuttlebutt, each node can maintain signed logs:

```
LogEntry:
  sequence:    uint64
  author:      NodeID
  prev_hash:   bytes[32]     // hash of previous entry (chain integrity)
  content:     bytes
  timestamp:   uint64
  signature:   Ed25519Sig

// A log is: author's NodeID + chain of signed entries
// Anyone can verify the log's integrity
// Logs can be replicated offline and verified later
```

---

## Cross-Cutting Concerns

### Wire Format

All data on the wire uses a compact binary encoding:

```
Tag-Length-Value (TLV) encoding:
  ┌─────┬──────┬───────────┐
  │ Tag │ Len  │   Value   │
  │ 2B  │ 4B   │ Variable  │
  └─────┴──────┴───────────┘
```

### Error Handling

Every layer propagates errors upward with structured error types:

```
VeilError:
  layer:    string    // which layer originated the error
  code:     uint16    // error code
  message:  string    // human-readable description
  retry:    bool      // is this retryable?
```

### Versioning

The stack uses version negotiation at the Bifrost layer. Each frame carries a version byte, and nodes negotiate compatible versions during handshake.

### Metrics and Observability

Every layer emits structured metrics:
- Bifrost: bytes sent/received per transport, connection counts
- Yggdrasil: peer count, routing table size, lookup latency
- Veil: stream counts, encryption overhead, retransmission rate
- Saga: content cache hits, service discovery latency
- Rune: attestation graph size, capability checks
- Realm: RPC latency, pub/sub message rates, CRDT sync lag

---

## Data Flow Example

**Alice sends a message to Bob:**

```
1. [Realm]     Alice's chat app calls realm.send(bob_id, "Hello")
2. [Rune]      Check: does Alice have a capability to message Bob? Yes (mutual follow)
3. [Saga]      Wrap message in a ContentEnvelope, compute CID, sign it
4. [Veil]      Encrypt and send on the Veil stream to Bob
                (or open a new connection if needed: Noise IK handshake)
5. [Yggdrasil] Route to Bob's NodeID
                - Check peer table: is Bob a direct peer? If yes, send directly
                - If not, DHT lookup for Bob's current PathAddr
6. [Bifrost]   Frame the packet and send over the appropriate transport (TCP/WS/UDP)
7. [Physical]  Bits on the wire

Bob receives:
1. [Bifrost]   Receive frame, validate magic bytes, extract payload
2. [Yggdrasil] Packet is addressed to local NodeID -- accept
3. [Veil]      Decrypt with session key, deliver to correct stream
4. [Saga]      Verify ContentEnvelope signature, validate CID
5. [Rune]      Verify Alice's capability to send messages
6. [Realm]     Deliver to Bob's chat application
```

**Alice retrieves content by hash:**

```
1. [Realm]     App calls realm.get(content_id)
2. [Saga]      Emit WANT(content_id) -- check local cache first
3. [Yggdrasil] If not cached, DHT lookup: who has content_id?
4. [Yggdrasil] Returns list of peers holding this content
5. [Veil]      Connect to nearest peer, request content
6. [Saga]      Receive ContentEnvelope, verify CID matches hash, verify signature
7. [Realm]     Return content to app -- doesn't matter who served it
```

---

*Next: [02-poc-design.md](./02-poc-design.md) -- Proof of Concept Design*
