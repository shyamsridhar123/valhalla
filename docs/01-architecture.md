# The Valhalla Stack: Architecture

## Stack Overview

Valhalla implements a 6-layer overlay protocol stack that runs on top of existing TCP/IP infrastructure. Each layer is an application-level abstraction implemented in Go, handling a specific concern (framing, routing, encryption, content, trust, application services).

The layer numbering (1-6) is an **internal Valhalla convention** inspired by the OSI model's separation of concerns. It does not correspond to actual OSI layer numbers. In OSI terms, the entire Valhalla stack operates within Layer 7 (Application), riding on the OS kernel's TCP/IP implementation for actual network I/O.

```
    Valhalla Overlay Stack                    Conceptual Role
   ──────────────────────                    ────────────────

   ┌────────────────────────────────────────────┐
   │ 6  Realm (App Mesh)                        │  Like OSI L7: application services
   │    P2P services, CRDT state sync            │
   ├────────────────────────────────────────────┤
   │ 5  Rune (Trust)                            │  Like OSI L5-6: session trust, presentation
   │    Capabilities, reputation, attestation    │
   ├────────────────────────────────────────────┤
   │ 4  Saga (Intent)                           │  Like DNS + HTTP semantics: content + discovery
   │    Content addressing, service discovery    │
   ├────────────────────────────────────────────┤
   │ 3  Veil (Flow)                             │  Like TLS + stream mux: encryption + channels
   │    Encrypted streams, multiplexing         │
   ├────────────────────────────────────────────┤
   │ 2  Yggdrasil (Mesh)                        │  Like overlay routing: identity + forwarding
   │    Crypto identity, DHT routing            │
   ├────────────────────────────────────────────┤
   │ 1  Bifrost (Bridge)                        │  Framing protocol over host transports
   │    Framing & tunneling over existing nets   │
   ╞════════════════════════════════════════════╡
   │    Host OS TCP/IP Stack                    │  Actual OSI L1-L4
   │    TCP, UDP, WebSocket (unchanged)          │  (kernel-managed, not touched by Valhalla)
   └────────────────────────────────────────────┘
```

### What "Layered" Means Here

Each Valhalla layer is a Go package that processes data structures (not raw network packets). When data flows through the stack:

1. Upper layers create typed Go structs (RPCRequest, ContentEnvelope, etc.)
2. Each layer transforms or wraps the data as it passes through
3. At the bottom, Bifrost serializes the final structure to bytes
4. Those bytes are written to a standard `net.Conn` (TCP/WebSocket)
5. The OS kernel handles actual packet framing, IP routing, and physical transmission

This is the same architectural pattern used by:
- **libp2p**: modular protocol stack with identity, routing, encryption, multiplexing
- **Tor**: layered encryption over TCP connections
- **CJDNS/Yggdrasil Network**: overlay routing with cryptographic addresses
- **QUIC**: encrypted transport protocol running over UDP

Each layer has a Norse-inspired codename reflecting its role:
- **Bifrost** (the rainbow bridge) -- bridges between the old internet and the new
- **Yggdrasil** (the world tree) -- connects all nodes in a unified mesh
- **Veil** -- the encrypted shroud over all communication
- **Saga** -- stories/data that persist and travel independent of their teller
- **Rune** -- inscriptions of trust and authority
- **Realm** -- the application world built on top

---

## Layer 1: Bifrost (Bridge)

**Purpose:** Provide a framing protocol over existing host transports.

Bifrost is the lowest layer of the Valhalla overlay. It does **not** interact with physical network interfaces, Ethernet frames, or MAC addresses. Instead, it defines a simple binary framing protocol that rides on top of existing transport connections (TCP, WebSocket, UDP) provided by the OS.

Think of it as Valhalla's equivalent of length-prefixed message framing — the same thing that protocols like gRPC, HTTP/2, or AMQP do over TCP.

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

Yggdrasil is the overlay network layer. It does **not** parse IP headers or interact with the kernel routing table. Instead, it maintains its own address space (NodeIDs derived from Ed25519 public keys) and its own routing logic (Kademlia DHT) within the application. Messages are routed by NodeID through the overlay's peer-to-peer connections, which themselves ride on TCP/WebSocket.

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

**Purpose:** Encrypted, multiplexed communication streams within the overlay.

Veil handles encryption and stream multiplexing. It does **not** replace TCP or parse TCP headers. Instead, it wraps existing `net.Conn` connections with a Noise protocol handshake and then multiplexes encrypted streams over that connection. This is conceptually similar to what TLS + HTTP/2 do, but with mutual authentication and no CA dependency.

### Connection Establishment

Veil uses the **Noise XX** handshake pattern (1.5-RTT, mutual authentication where neither side knows the other's static key in advance):

```
Initiator (I) and Responder (R) exchange keys over 3 messages:

  I -> R:  e                         // Initiator's ephemeral key
  R -> I:  e, ee, s, es              // Responder's ephemeral + encrypted static key
  I -> R:  s, se                     // Initiator's encrypted static key

After 1.5 round trips: mutual authentication + forward-secret encrypted channel
```

XX was chosen for the PoC because it does not require the initiator to know the responder's static key beforehand, simplifying bootstrap. A future optimization could use **Noise IK** (1-RTT) when the initiator has cached the responder's key from a previous session.

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

**Purpose:** Content addressing, service discovery, and structured data exchange within the overlay.

Saga provides content-addressed storage and intent-based service discovery. Instead of connecting to a specific server by IP, nodes express what content or service they need, and the overlay resolves it. This is conceptually similar to what IPFS does for content addressing or what DNS + HTTP do for service discovery — but unified into one layer with cryptographic integrity built in.

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

**Purpose:** Decentralized trust, capability-based access control, and reputation within the overlay.

Rune provides a web-of-trust model and capability tokens as an alternative to the Certificate Authority hierarchy. Nodes vouch for each other through signed attestations, and access control uses self-contained, cryptographically verifiable capability tokens. This is purely an application-level trust framework — it does not interact with system-level certificate stores or TLS infrastructure.

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

## Technical Reality: Overlay vs. Kernel Stack

It's important to understand what this architecture is and is not.

### What Actually Happens on the Wire

When Alice sends a message to Bob through Valhalla, the actual network traffic is:

1. A **standard TCP connection** between two IP addresses (or a WebSocket connection)
2. Over that TCP stream, **Bifrost frames** (7-byte header + payload) carry the overlay protocol data
3. Within those frames, Veil encryption wraps the actual message content
4. The OS kernel handles all real L1-L4 concerns: Ethernet framing, IP routing, TCP flow control, congestion management

An observer with a packet capture tool would see: **ordinary TCP traffic** between two IP addresses. The Valhalla framing, routing, and encryption are visible only within the TCP payload.

### What This Means

- **Bifrost does not touch Ethernet frames** or MAC addresses. It writes bytes to a `net.Conn`.
- **Yggdrasil does not parse IP headers** or manipulate the kernel routing table. It maintains an overlay routing table in Go memory.
- **Veil does not replace TCP**. It adds encryption and multiplexing *on top of* a TCP connection.
- **The TTL field in Yggdrasil messages** is an overlay hop counter, not the IP TTL field.
- **NodeIDs are overlay addresses**, not IP addresses. The mapping from NodeID to actual IP:port is maintained by the DHT.

### The Demo Network

In the PoC's `--demo` mode, the architecture is further simplified: nodes communicate via **direct Go function calls in the same process**, bypassing even the TCP transport. This makes demos deterministic and fast but means no actual network I/O occurs between nodes.

### Where Real Protocol Work Happens

Despite being an overlay, the following operations are genuine and functional:
- **Ed25519 key generation and signing** — real cryptographic operations
- **Noise XX handshakes** — real authenticated key exchange (via `flynn/noise`)
- **ChaCha20-Poly1305 encryption** — real AEAD encryption of all overlay traffic
- **SHA-256 content addressing** — real content-addressed storage with integrity verification
- **Kademlia DHT routing** — real XOR-distance-based peer lookup

The cryptography is not simulated. The overlay routing is not simulated. The layered architecture is functional. What's missing is the kernel-level integration that would make this a true replacement for TCP/IP rather than a layer on top of it.

---

*Next: [02-poc-design.md](./02-poc-design.md) -- Proof of Concept Design*
