package yggdrasil

import (
	"sort"
	"sync"

	"github.com/valhalla/valhalla/internal/types"
)

const (
	// KBucketSize is the max number of peers per bucket (Kademlia k parameter).
	KBucketSize = 20
	// NumBuckets is the number of k-buckets (one per bit of NodeID).
	NumBuckets = 256
)

// PeerTable is a Kademlia-style k-bucket peer table.
type PeerTable struct {
	self    types.NodeID
	buckets [NumBuckets][]PeerInfo
	mu      sync.RWMutex
}

// NewPeerTable creates a peer table centered on the given NodeID.
func NewPeerTable(self types.NodeID) *PeerTable {
	return &PeerTable{self: self}
}

// bucketIndex returns the k-bucket index for a given NodeID.
// It is the index of the highest bit in XOR(self, target).
func (pt *PeerTable) bucketIndex(target types.NodeID) int {
	dist := types.XORDistance(pt.self, target)
	for i := 0; i < 32; i++ {
		for bit := 7; bit >= 0; bit-- {
			if dist[i]&(1<<uint(bit)) != 0 {
				return i*8 + (7 - bit)
			}
		}
	}
	return NumBuckets - 1 // same node
}

// AddPeer adds or updates a peer in the table.
func (pt *PeerTable) AddPeer(peer PeerInfo) {
	if peer.NodeID == pt.self {
		return // don't add self
	}
	pt.mu.Lock()
	defer pt.mu.Unlock()

	idx := pt.bucketIndex(peer.NodeID)
	bucket := pt.buckets[idx]

	// Check if peer already exists, update if so
	for i, existing := range bucket {
		if existing.NodeID == peer.NodeID {
			pt.buckets[idx][i] = peer
			return
		}
	}

	// Add new peer if bucket not full
	if len(bucket) < KBucketSize {
		pt.buckets[idx] = append(bucket, peer)
	}
	// If full, Kademlia would ping least-recently-seen; PoC just drops
}

// RemovePeer removes a peer from the table.
func (pt *PeerTable) RemovePeer(id types.NodeID) {
	pt.mu.Lock()
	defer pt.mu.Unlock()

	idx := pt.bucketIndex(id)
	bucket := pt.buckets[idx]

	for i, peer := range bucket {
		if peer.NodeID == id {
			pt.buckets[idx] = append(bucket[:i], bucket[i+1:]...)
			return
		}
	}
}

// FindClosest returns up to k peers closest to the target NodeID.
func (pt *PeerTable) FindClosest(target types.NodeID, k int) []PeerInfo {
	pt.mu.RLock()
	defer pt.mu.RUnlock()

	// Collect all peers
	var all []PeerInfo
	for _, bucket := range pt.buckets {
		all = append(all, bucket...)
	}

	// Sort by XOR distance to target
	sort.Slice(all, func(i, j int) bool {
		di := types.XORDistance(all[i].NodeID, target)
		dj := types.XORDistance(all[j].NodeID, target)
		for b := 0; b < 32; b++ {
			if di[b] != dj[b] {
				return di[b] < dj[b]
			}
		}
		return false
	})

	if len(all) > k {
		all = all[:k]
	}
	return all
}

// GetPeer returns a peer by NodeID if known.
func (pt *PeerTable) GetPeer(id types.NodeID) (PeerInfo, bool) {
	pt.mu.RLock()
	defer pt.mu.RUnlock()

	idx := pt.bucketIndex(id)
	for _, peer := range pt.buckets[idx] {
		if peer.NodeID == id {
			return peer, true
		}
	}
	return PeerInfo{}, false
}

// AllPeers returns all known peers.
func (pt *PeerTable) AllPeers() []PeerInfo {
	pt.mu.RLock()
	defer pt.mu.RUnlock()

	var all []PeerInfo
	for _, bucket := range pt.buckets {
		all = append(all, bucket...)
	}
	return all
}

// Size returns the total number of known peers.
func (pt *PeerTable) Size() int {
	pt.mu.RLock()
	defer pt.mu.RUnlock()

	count := 0
	for _, bucket := range pt.buckets {
		count += len(bucket)
	}
	return count
}
