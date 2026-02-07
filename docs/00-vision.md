# Project Valhalla: Reimagining the Internet Stack

## The Thesis

The internet's core architecture -- the OSI/TCP-IP model -- was designed in the 1970s-80s for a world of stationary mainframes connected by dedicated links. Fifty years later, we have billions of mobile devices, pervasive encryption needs, content delivery at planetary scale, and an entire economy running on a stack that conflates identity with location, treats security as an afterthought, and routes to machines instead of data.

We cannot change the physical layer. Fiber, copper, and radio are what they are. But everything above the wire -- from framing to applications -- deserves a ground-up rethink.

**Project Valhalla** is that rethink: a new network stack designed for the world as it is, not the world of 1983.

---

## What's Wrong With the Current Stack

### 1. IP Addresses Are a Broken Abstraction

An IP address tries to be two things at once:
- **An identity** -- "who you are" (used by firewalls, ACLs, logging, transport bindings)
- **A locator** -- "where you are" (used by routers to forward packets)

This conflation is the root cause of:
- **NAT**: We ran out of IPv4 addresses, so we broke end-to-end connectivity with address translation hacks. Entire classes of applications (P2P, VoIP, gaming) need elaborate NAT traversal.
- **Mobility breakage**: Walk from WiFi to cellular and every TCP connection dies, because the identity (IP) changed even though the endpoint (you) didn't.
- **Multihoming complexity**: A server with two ISPs has two identities, requiring BGP gymnastics.
- **Renumbering pain**: Changing ISPs means changing identity, breaking every hardcoded reference.

### 2. Security Was Bolted On, Not Built In

- TCP was designed with no encryption, no authentication, no integrity protection.
- SSL/TLS was added 20 years later as a shim between transport and application.
- We now have a brittle tower: TCP handshake (1.5 RTT) + TLS handshake (1-2 RTT) before a single byte of application data flows.
- The Certificate Authority system is a centralized trust hierarchy where a single compromised CA (DigiNotar, Symantec) can forge identities for the entire internet.
- DNS is unencrypted by default, leaking every domain you visit to anyone on the path.

### 3. We Route to Machines, Not to Data

When you watch a video on YouTube, you don't care which server delivers the bytes. You care about the *content*. But the internet forces you to:
1. Resolve a human name (`youtube.com`) to a machine address (IP) via a centralized hierarchy (DNS)
2. Connect to that specific machine
3. Request the content by machine-relative path (`/watch?v=xyz`)
4. Trust that machine to serve the right data

CDNs, load balancers, and caches are billion-dollar band-aids over this fundamental mismatch. If content were addressed by *what it is* (its hash), any node holding the data could serve it, integrity would be self-verifying, and caching would be trivial.

### 4. The Client-Server Model Is an Assumption, Not a Necessity

The current stack assumes a privileged server and a dependent client. This is baked into:
- DNS (servers have names, clients don't)
- TLS (servers have certificates, clients usually don't)
- NAT (clients initiate, servers listen)
- HTTP (request/response to a server)

But most modern applications are peer-to-peer in nature: messaging, collaboration, file sharing, video calls, multiplayer games. We force them through client-server architectures because the stack doesn't support anything else cleanly.

### 5. Middlebox Ossification

Firewalls, NATs, proxies, and DPI boxes inspect and modify traffic based on assumptions about packet format. This makes protocol evolution nearly impossible:
- TCP options beyond the basics get stripped
- New transport protocols over IP get blocked
- Even minor TCP behavior changes break middlebox assumptions

QUIC's response -- encrypt everything and run over UDP -- is an admission that the stack cannot be evolved through its own mechanisms.

### 6. Privacy as an Afterthought

- IP addresses are persistent identifiers that enable tracking
- DNS queries are broadcast in cleartext
- TCP metadata (ports, sequence numbers) is visible to all intermediaries
- Even with TLS, the SNI field leaks which site you're visiting
- Metadata (who talks to whom, when, how much) is visible to every hop

---

## The Design Principles of the New Stack

### Principle 1: Identity Is Cryptographic
Your identity is your public key. Not an IP address. Not a domain name. A key you generate, you control, and nobody can impersonate without your private key.

### Principle 2: Identity and Location Are Separate Concerns
Routing finds *where* a cryptographic identity currently is. The binding is dynamic and private. Changing physical location never changes identity.

### Principle 3: Security Is Structural, Not Optional
Every communication is encrypted and authenticated. There is no unencrypted mode. There is no unauthenticated mode. The stack does not have a "plain" option.

### Principle 4: Name Data, Not Machines
Content is addressed by hash. Services are addressed by capability. Neither requires knowing where data physically resides.

### Principle 5: Peer-to-Peer Is the Default
Every node is both client and server. The stack does not privilege one role over another. NAT doesn't exist because addresses aren't scarce (they're hashes of keys).

### Principle 6: The Stack Resists Ossification
Wire formats are encrypted. Intermediaries cannot inspect or modify what they don't understand. Protocol evolution is a feature, not a bug.

### Principle 7: Offline-First, Not Online-Only
Communication produces signed, verifiable artifacts (logs, content blocks) that can be relayed, cached, and verified without the original sender being online.

---

## What Valhalla Is NOT

- **Not a blockchain.** There is no global consensus, no mining, no tokens. Decentralization doesn't require a ledger.
- **Not a VPN or Tor replacement.** Anonymity is a feature that can be layered in, but the core goal is a better architecture, not just privacy.
- **Not theoretical.** This is a working proof-of-concept, not a whitepaper. Real packets flow through real code.
- **Not a proposal to replace the internet overnight.** It runs *over* existing IP infrastructure as an overlay, proving that a better architecture is possible.

---

## The Opportunity

Every major internet innovation of the last decade has been working around the stack's limitations:
- **QUIC** encrypts transport headers to prevent middlebox ossification
- **DoH/DoT** encrypts DNS to prevent snooping
- **WebRTC** adds P2P to browsers via STUN/TURN/ICE hacks
- **Tailscale/WireGuard** create overlay networks with cryptographic identity
- **IPFS** builds content-addressing on top of the existing stack
- **Signal Protocol** builds end-to-end encryption above the application layer

Each of these is a patch on a fundamentally broken architecture. Valhalla asks: what if we started over?

---

*Next: [01-architecture.md](./01-architecture.md) -- The Valhalla Stack*
