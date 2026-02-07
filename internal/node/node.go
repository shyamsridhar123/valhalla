package node

import (
	"fmt"
	"sync"

	"github.com/valhalla/valhalla/internal/realm"
	vrune "github.com/valhalla/valhalla/internal/rune"
	"github.com/valhalla/valhalla/internal/saga"
	"github.com/valhalla/valhalla/internal/types"
	"github.com/valhalla/valhalla/internal/yggdrasil"
)

// Node represents a single Valhalla node with all stack layers.
type Node struct {
	Identity    *yggdrasil.Identity
	PeerTable   *yggdrasil.PeerTable
	DHT         *yggdrasil.DHT
	Cache       *saga.Cache
	Services    *saga.ServiceRegistry
	RPCRouter   *realm.RPCRouter
	PubSub      *realm.PubSub
	CRDTStore   *realm.LWWStore
	TrustStore  *vrune.AttestationStore
	ListenAddr  string
	Port        int

	mu          sync.RWMutex
	peers       map[types.NodeID]*Node // direct references for in-process demo
	events      chan types.StackEvent
}

// NewNode creates a new Valhalla node with all layers initialized.
func NewNode(port int) (*Node, error) {
	id, err := yggdrasil.GenerateIdentity()
	if err != nil {
		return nil, fmt.Errorf("generate identity: %w", err)
	}

	n := &Node{
		Identity:   id,
		PeerTable:  yggdrasil.NewPeerTable(id.NodeID),
		DHT:        yggdrasil.NewDHT(id.NodeID),
		Cache:      saga.NewCache(1000),
		Services:   saga.NewServiceRegistry(),
		RPCRouter:  realm.NewRPCRouter(),
		PubSub:     realm.NewPubSub(),
		CRDTStore:  realm.NewLWWStore(),
		TrustStore: vrune.NewAttestationStore(),
		ListenAddr: fmt.Sprintf("127.0.0.1:%d", port),
		Port:       port,
		peers:      make(map[types.NodeID]*Node),
		events:     make(chan types.StackEvent, 256),
	}

	return n, nil
}

// NodeID returns this node's identity.
func (n *Node) NodeID() types.NodeID {
	return n.Identity.NodeID
}

// ShortID returns a short representation of the node ID.
func (n *Node) ShortID() string {
	return n.Identity.NodeID.String()[:12]
}

// ConnectPeer establishes a direct in-process connection to another node.
func (n *Node) ConnectPeer(peer *Node) {
	n.mu.Lock()
	n.peers[peer.NodeID()] = peer
	n.mu.Unlock()

	n.PeerTable.AddPeer(yggdrasil.PeerInfo{
		NodeID:    peer.NodeID(),
		PublicKey: peer.Identity.PublicKey,
		Addrs:     []types.PathAddr{types.PathAddr(fmt.Sprintf("/tcp/%s", peer.ListenAddr))},
	})

	n.EmitEvent("yggdrasil", "peer_connected", map[string]string{
		"peer": peer.ShortID(),
	})
}

// GetPeer returns a direct peer by NodeID.
func (n *Node) GetPeer(id types.NodeID) (*Node, bool) {
	n.mu.RLock()
	defer n.mu.RUnlock()
	peer, ok := n.peers[id]
	return peer, ok
}

// Peers returns all directly connected peers.
func (n *Node) Peers() []*Node {
	n.mu.RLock()
	defer n.mu.RUnlock()
	peers := make([]*Node, 0, len(n.peers))
	for _, p := range n.peers {
		peers = append(peers, p)
	}
	return peers
}

// EmitEvent sends a stack event for the UI.
func (n *Node) EmitEvent(layer, eventType string, data map[string]string) {
	evt := types.NewStackEvent(layer, eventType, n.NodeID(), data)
	select {
	case n.events <- evt:
	default:
		// Drop if buffer full
	}
}

// Events returns the event channel for this node.
func (n *Node) Events() <-chan types.StackEvent {
	return n.events
}

// SendRPC sends an RPC request to a peer and returns the response.
func (n *Node) SendRPC(target types.NodeID, service, method string, args []byte) (*realm.RPCResponse, error) {
	peer, ok := n.GetPeer(target)
	if !ok {
		return nil, fmt.Errorf("no connection to peer %s", target.String()[:12])
	}

	req := &realm.RPCRequest{
		Service: service,
		Method:  method,
		Args:    args,
		From:    n.NodeID(),
	}

	n.EmitEvent("realm", "rpc_call", map[string]string{
		"target":  peer.ShortID(),
		"service": service,
		"method":  method,
	})

	resp := peer.RPCRouter.Dispatch(req)
	return resp, nil
}

// PublishContent creates and caches a content envelope.
func (n *Node) PublishContent(data []byte, meta map[string]string) *saga.ContentEnvelope {
	env := saga.NewContentEnvelope(data, n.Identity, meta, 0)
	n.Cache.Put(env)

	n.EmitEvent("saga", "content_published", map[string]string{
		"cid":  env.CID.String(),
		"size": fmt.Sprintf("%d", len(data)),
	})

	// Share with peers
	n.mu.RLock()
	for _, peer := range n.peers {
		peer.Cache.Put(env)
	}
	n.mu.RUnlock()

	return env
}
