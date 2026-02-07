package demo

import (
	"context"
	"fmt"
	"time"

	vrune "github.com/valhalla/valhalla/internal/rune"
	"github.com/valhalla/valhalla/internal/saga"
	"github.com/valhalla/valhalla/internal/types"
)

// Scenario is a runnable demo scenario.
type Scenario struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Run         func(ctx context.Context, net *Network, narrate func(string)) error `json:"-"`
}

// AllScenarios returns the set of demo scenarios.
func AllScenarios() []Scenario {
	return []Scenario{
		{
			Name:        "mesh-formation",
			Description: "6 nodes discover each other and form a mesh network",
			Run:         scenarioMeshFormation,
		},
		{
			Name:        "encrypted-chat",
			Description: "Two nodes establish encrypted communication and exchange messages",
			Run:         scenarioEncryptedChat,
		},
		{
			Name:        "content-sharing",
			Description: "Content published by one node is discovered and retrieved by another",
			Run:         scenarioContentSharing,
		},
		{
			Name:        "trust-web",
			Description: "Nodes build a web of trust through attestations",
			Run:         scenarioTrustWeb,
		},
		{
			Name:        "service-discovery",
			Description: "A node discovers and connects to a service provided by another node",
			Run:         scenarioServiceDiscovery,
		},
		{
			Name:        "state-sync",
			Description: "Nodes synchronize shared state using CRDTs",
			Run:         scenarioStateSync,
		},
	}
}

func scenarioMeshFormation(ctx context.Context, net *Network, narrate func(string)) error {
	narrate("Starting mesh formation with 6 nodes...")
	pause(ctx, 500*time.Millisecond)

	for i, nd := range net.Nodes {
		narrate(fmt.Sprintf("Node %d (%s) joins the network at %s",
			i, nd.ShortID(), nd.ListenAddr))
		nd.EmitEvent("yggdrasil", "node_joined", map[string]string{
			"index":   fmt.Sprintf("%d", i),
			"address": nd.ListenAddr,
		})
		pause(ctx, 300*time.Millisecond)
	}

	narrate(fmt.Sprintf("Mesh formed: %d nodes, each connected to %d peers",
		net.Size(), net.Size()-1))

	// Show routing table
	for i, nd := range net.Nodes {
		peers := nd.Peers()
		narrate(fmt.Sprintf("Node %d routing table: %d peers", i, len(peers)))
	}

	return nil
}

func scenarioEncryptedChat(ctx context.Context, net *Network, narrate func(string)) error {
	alice := net.NodeByIndex(0)
	bob := net.NodeByIndex(1)

	narrate(fmt.Sprintf("Alice (%s) initiates encrypted chat with Bob (%s)",
		alice.ShortID(), bob.ShortID()))
	pause(ctx, 500*time.Millisecond)

	// Register chat service on Bob
	bob.RPCRouter.RegisterService("chat", func(method string, args []byte, from types.NodeID) ([]byte, error) {
		if method == "message" {
			bob.EmitEvent("realm", "chat_received", map[string]string{
				"from":    from.String()[:12],
				"message": string(args),
			})
			return []byte("delivered"), nil
		}
		return nil, fmt.Errorf("unknown method: %s", method)
	})

	// Alice sends messages
	messages := []string{
		"Hello Bob! This message is encrypted end-to-end.",
		"Only you can read this - the network sees only ciphertext.",
		"This is the power of identity-first networking.",
	}

	for _, msg := range messages {
		narrate(fmt.Sprintf("Alice → Bob (encrypted): %s", msg))
		alice.EmitEvent("veil", "encrypt", map[string]string{"target": bob.ShortID()})

		resp, err := alice.SendRPC(bob.NodeID(), "chat", "message", []byte(msg))
		if err != nil {
			return fmt.Errorf("send rpc: %w", err)
		}
		if resp.Error != "" {
			return fmt.Errorf("rpc error: %s", resp.Error)
		}

		narrate(fmt.Sprintf("  ↳ Delivered (response: %s)", resp.Data))
		pause(ctx, 400*time.Millisecond)
	}

	narrate("Encrypted chat scenario complete.")
	return nil
}

func scenarioContentSharing(ctx context.Context, net *Network, narrate func(string)) error {
	publisher := net.NodeByIndex(0)
	retriever := net.NodeByIndex(4)

	narrate(fmt.Sprintf("Node 0 (%s) publishes content...", publisher.ShortID()))
	pause(ctx, 300*time.Millisecond)

	content := []byte("The Valhalla Protocol: A new foundation for the internet, " +
		"where identity is cryptographic, security is mandatory, and " +
		"addressing is content-based rather than location-based.")

	env := publisher.PublishContent(content, map[string]string{
		"type":  "text/plain",
		"title": "Valhalla Manifesto",
	})

	narrate(fmt.Sprintf("Published with CID: %s", env.CID.String()[:16]))
	pause(ctx, 500*time.Millisecond)

	// Retriever fetches from cache (propagated via peers)
	narrate(fmt.Sprintf("Node 4 (%s) retrieves content by CID...", retriever.ShortID()))

	retrieved, ok := retriever.Cache.Get(env.CID)
	if !ok {
		return fmt.Errorf("content not found in cache")
	}

	narrate(fmt.Sprintf("  ↳ Retrieved %d bytes, publisher: %s",
		len(retrieved.Data), retrieved.Publisher.String()[:12]))
	narrate(fmt.Sprintf("  ↳ Signature valid: %v", saga.VerifyEnvelope(retrieved) == nil))

	return nil
}

func scenarioTrustWeb(ctx context.Context, net *Network, narrate func(string)) error {
	alice := net.NodeByIndex(0)
	bob := net.NodeByIndex(1)
	carol := net.NodeByIndex(2)

	narrate("Building a web of trust...")
	pause(ctx, 300*time.Millisecond)

	store := vrune.NewAttestationStore()

	// Alice attests Bob
	att1 := vrune.CreateAttestation(alice.Identity, bob.NodeID(), "is-trusted", 0.9, time.Hour)
	store.Add(att1)
	narrate(fmt.Sprintf("Alice attests Bob: \"is-trusted\" (confidence: 0.9)"))
	alice.EmitEvent("rune", "attestation_created", map[string]string{
		"subject": bob.ShortID(), "claim": "is-trusted", "confidence": "0.9",
	})
	pause(ctx, 300*time.Millisecond)

	// Bob attests Carol
	att2 := vrune.CreateAttestation(bob.Identity, carol.NodeID(), "is-trusted", 0.85, time.Hour)
	store.Add(att2)
	narrate(fmt.Sprintf("Bob attests Carol: \"is-trusted\" (confidence: 0.85)"))
	bob.EmitEvent("rune", "attestation_created", map[string]string{
		"subject": carol.ShortID(), "claim": "is-trusted", "confidence": "0.85",
	})
	pause(ctx, 300*time.Millisecond)

	// Compute trust
	trustBob := vrune.ComputeTrust(store, alice.NodeID(), bob.NodeID())
	trustCarol := vrune.ComputeTrust(store, alice.NodeID(), carol.NodeID())

	narrate(fmt.Sprintf("Alice's trust in Bob (direct): %.2f", trustBob))
	narrate(fmt.Sprintf("Alice's trust in Carol (transitive via Bob): %.2f", trustCarol))
	narrate(fmt.Sprintf("Trust decays transitively: %.2f < %.2f", trustCarol, trustBob))

	return nil
}

func scenarioServiceDiscovery(ctx context.Context, net *Network, narrate func(string)) error {
	provider := net.NodeByIndex(2)
	consumer := net.NodeByIndex(5)

	narrate(fmt.Sprintf("Node 2 (%s) registers 'file-storage' service...", provider.ShortID()))

	provider.RPCRouter.RegisterService("file-storage", func(method string, args []byte, from types.NodeID) ([]byte, error) {
		switch method {
		case "list":
			return []byte(`["readme.md","config.json","data.bin"]`), nil
		case "get":
			return []byte("file content for: " + string(args)), nil
		default:
			return nil, fmt.Errorf("unknown method: %s", method)
		}
	})

	provider.Services.Register(saga.ServiceRecord{
		ServiceName: "file-storage",
		NodeID:      provider.NodeID(),
		Version:     "1.0",
	})
	pause(ctx, 300*time.Millisecond)

	narrate(fmt.Sprintf("Node 5 (%s) discovers file-storage service...", consumer.ShortID()))

	// Find the service (in-process: direct lookup)
	resp, err := consumer.SendRPC(provider.NodeID(), "file-storage", "list", nil)
	if err != nil {
		return err
	}
	narrate(fmt.Sprintf("  ↳ Files: %s", resp.Data))
	pause(ctx, 300*time.Millisecond)

	resp, err = consumer.SendRPC(provider.NodeID(), "file-storage", "get", []byte("readme.md"))
	if err != nil {
		return err
	}
	narrate(fmt.Sprintf("  ↳ Retrieved: %s", resp.Data))

	return nil
}

func scenarioStateSync(ctx context.Context, net *Network, narrate func(string)) error {
	node0 := net.NodeByIndex(0)
	node1 := net.NodeByIndex(1)
	node2 := net.NodeByIndex(2)

	narrate("Demonstrating CRDT state synchronization...")
	pause(ctx, 300*time.Millisecond)

	// Each node sets some state
	node0.CRDTStore.Set("room/topic", []byte("Welcome to Valhalla"), node0.NodeID())
	narrate(fmt.Sprintf("Node 0 sets room/topic = 'Welcome to Valhalla'"))
	pause(ctx, 200*time.Millisecond)

	node1.CRDTStore.Set("room/members", []byte("3"), node1.NodeID())
	narrate(fmt.Sprintf("Node 1 sets room/members = '3'"))
	pause(ctx, 200*time.Millisecond)

	node2.CRDTStore.Set("room/topic", []byte("Valhalla Chat Room"), node2.NodeID())
	narrate(fmt.Sprintf("Node 2 sets room/topic = 'Valhalla Chat Room' (concurrent update)"))
	pause(ctx, 300*time.Millisecond)

	// Sync: merge all states
	narrate("Synchronizing state across all nodes...")
	snap0 := node0.CRDTStore.Snapshot()
	snap1 := node1.CRDTStore.Snapshot()
	snap2 := node2.CRDTStore.Snapshot()

	node0.CRDTStore.Merge(snap1)
	node0.CRDTStore.Merge(snap2)
	node1.CRDTStore.Merge(snap0)
	node1.CRDTStore.Merge(snap2)
	node2.CRDTStore.Merge(snap0)
	node2.CRDTStore.Merge(snap1)

	// Verify convergence
	topic0, _ := node0.CRDTStore.Get("room/topic")
	topic1, _ := node1.CRDTStore.Get("room/topic")
	topic2, _ := node2.CRDTStore.Get("room/topic")

	narrate(fmt.Sprintf("After sync - Node 0 topic: %q", topic0))
	narrate(fmt.Sprintf("After sync - Node 1 topic: %q", topic1))
	narrate(fmt.Sprintf("After sync - Node 2 topic: %q", topic2))

	if string(topic0) == string(topic1) && string(topic1) == string(topic2) {
		narrate("All nodes converged to the same state (Last-Writer-Wins).")
	}

	return nil
}

// pause waits for the specified duration or until context is cancelled.
func pause(ctx context.Context, d time.Duration) {
	select {
	case <-ctx.Done():
	case <-time.After(d):
	}
}
