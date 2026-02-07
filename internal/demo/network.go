package demo

import (
	"fmt"
	"sync"

	"github.com/valhalla/valhalla/internal/node"
	"github.com/valhalla/valhalla/internal/types"
)

// Network manages a collection of nodes for demo purposes.
type Network struct {
	mu    sync.RWMutex
	Nodes []*node.Node
	base  int
}

// NewNetwork creates and connects N nodes starting at basePort.
func NewNetwork(count, basePort int) (*Network, error) {
	net := &Network{
		Nodes: make([]*node.Node, 0, count),
		base:  basePort,
	}

	for i := 0; i < count; i++ {
		n, err := node.NewNode(basePort + i)
		if err != nil {
			return nil, fmt.Errorf("create node %d: %w", i, err)
		}
		net.Nodes = append(net.Nodes, n)
	}

	// Connect nodes in a mesh (every node connects to every other)
	for i, n := range net.Nodes {
		for j, peer := range net.Nodes {
			if i != j {
				n.ConnectPeer(peer)
			}
		}
	}

	return net, nil
}

// NodeByIndex returns the i-th node.
func (n *Network) NodeByIndex(i int) *node.Node {
	n.mu.RLock()
	defer n.mu.RUnlock()
	if i < 0 || i >= len(n.Nodes) {
		return nil
	}
	return n.Nodes[i]
}

// NodeByID returns the node with the given NodeID.
func (n *Network) NodeByID(id types.NodeID) *node.Node {
	n.mu.RLock()
	defer n.mu.RUnlock()
	for _, nd := range n.Nodes {
		if nd.NodeID() == id {
			return nd
		}
	}
	return nil
}

// Size returns the number of nodes in the network.
func (n *Network) Size() int {
	n.mu.RLock()
	defer n.mu.RUnlock()
	return len(n.Nodes)
}

// DisconnectPair removes the peer connection between nodes[i] and nodes[j].
func (n *Network) DisconnectPair(i, j int) error {
	n.mu.RLock()
	defer n.mu.RUnlock()
	if i < 0 || i >= len(n.Nodes) || j < 0 || j >= len(n.Nodes) || i == j {
		return fmt.Errorf("invalid node indices: %d, %d", i, j)
	}
	n.Nodes[i].DisconnectPeer(n.Nodes[j].NodeID())
	n.Nodes[j].DisconnectPeer(n.Nodes[i].NodeID())
	return nil
}

// ReconnectPair re-establishes the peer connection between nodes[i] and nodes[j].
func (n *Network) ReconnectPair(i, j int) error {
	n.mu.RLock()
	defer n.mu.RUnlock()
	if i < 0 || i >= len(n.Nodes) || j < 0 || j >= len(n.Nodes) || i == j {
		return fmt.Errorf("invalid node indices: %d, %d", i, j)
	}
	n.Nodes[i].ConnectPeer(n.Nodes[j])
	n.Nodes[j].ConnectPeer(n.Nodes[i])
	return nil
}

// NodeInfo returns summary info about a node suitable for API responses.
type NodeInfo struct {
	NodeID    string   `json:"node_id"`
	ShortID   string   `json:"short_id"`
	Address   string   `json:"address"`
	Port      int      `json:"port"`
	PeerCount int      `json:"peer_count"`
	Services  []string `json:"services"`
}

// GetNodeInfo returns API-friendly info about a node.
func GetNodeInfo(nd *node.Node) NodeInfo {
	return NodeInfo{
		NodeID:    nd.NodeID().String(),
		ShortID:   nd.ShortID(),
		Address:   nd.ListenAddr,
		Port:      nd.Port,
		PeerCount: len(nd.Peers()),
		Services:  nd.RPCRouter.ListServices(),
	}
}

// GetAllNodeInfo returns info about all nodes in the network.
func (n *Network) GetAllNodeInfo() []NodeInfo {
	n.mu.RLock()
	defer n.mu.RUnlock()

	infos := make([]NodeInfo, len(n.Nodes))
	for i, nd := range n.Nodes {
		infos[i] = GetNodeInfo(nd)
	}
	return infos
}
