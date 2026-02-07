package yggdrasil

import (
	"testing"

	"github.com/valhalla/valhalla/internal/types"
)

func TestPeerTableAddAndGet(t *testing.T) {
	self, _ := GenerateIdentity()
	pt := NewPeerTable(self.NodeID)

	peer, _ := GenerateIdentity()
	info := PeerInfo{
		NodeID:    peer.NodeID,
		PublicKey: peer.PublicKey,
		Addrs:     []types.PathAddr{"/tcp/127.0.0.1:9001"},
	}

	pt.AddPeer(info)

	got, ok := pt.GetPeer(peer.NodeID)
	if !ok {
		t.Fatal("peer not found after AddPeer")
	}
	if got.NodeID != peer.NodeID {
		t.Error("retrieved peer has wrong NodeID")
	}
	if pt.Size() != 1 {
		t.Errorf("Size: got %d, want 1", pt.Size())
	}
}

func TestPeerTableDoesNotAddSelf(t *testing.T) {
	self, _ := GenerateIdentity()
	pt := NewPeerTable(self.NodeID)

	pt.AddPeer(PeerInfo{NodeID: self.NodeID})

	if pt.Size() != 0 {
		t.Error("should not add self to peer table")
	}
}

func TestPeerTableRemove(t *testing.T) {
	self, _ := GenerateIdentity()
	pt := NewPeerTable(self.NodeID)

	peer, _ := GenerateIdentity()
	pt.AddPeer(PeerInfo{NodeID: peer.NodeID, PublicKey: peer.PublicKey})

	pt.RemovePeer(peer.NodeID)

	if _, ok := pt.GetPeer(peer.NodeID); ok {
		t.Error("peer should be removed")
	}
	if pt.Size() != 0 {
		t.Errorf("Size after remove: got %d, want 0", pt.Size())
	}
}

func TestPeerTableFindClosest(t *testing.T) {
	self, _ := GenerateIdentity()
	pt := NewPeerTable(self.NodeID)

	// Add 10 peers
	peers := make([]*Identity, 10)
	for i := range peers {
		peers[i], _ = GenerateIdentity()
		pt.AddPeer(PeerInfo{NodeID: peers[i].NodeID, PublicKey: peers[i].PublicKey})
	}

	// Find 5 closest to a random target
	target, _ := GenerateIdentity()
	closest := pt.FindClosest(target.NodeID, 5)

	if len(closest) != 5 {
		t.Fatalf("FindClosest returned %d peers, want 5", len(closest))
	}

	// Verify ordering: each peer should be closer than the next
	for i := 1; i < len(closest); i++ {
		d1 := types.XORDistance(closest[i-1].NodeID, target.NodeID)
		d2 := types.XORDistance(closest[i].NodeID, target.NodeID)
		for b := 0; b < 32; b++ {
			if d1[b] < d2[b] {
				break
			}
			if d1[b] > d2[b] {
				t.Errorf("peers not sorted by distance at index %d", i)
				break
			}
		}
	}
}

func TestPeerTableUpdate(t *testing.T) {
	self, _ := GenerateIdentity()
	pt := NewPeerTable(self.NodeID)

	peer, _ := GenerateIdentity()
	pt.AddPeer(PeerInfo{
		NodeID:    peer.NodeID,
		PublicKey: peer.PublicKey,
		Addrs:     []types.PathAddr{"/tcp/127.0.0.1:9001"},
	})

	// Update with new address
	pt.AddPeer(PeerInfo{
		NodeID:    peer.NodeID,
		PublicKey: peer.PublicKey,
		Addrs:     []types.PathAddr{"/tcp/127.0.0.1:9002"},
	})

	if pt.Size() != 1 {
		t.Errorf("Size after update: got %d, want 1", pt.Size())
	}

	got, _ := pt.GetPeer(peer.NodeID)
	if len(got.Addrs) != 1 || got.Addrs[0] != "/tcp/127.0.0.1:9002" {
		t.Errorf("address not updated: got %v", got.Addrs)
	}
}

func TestPeerTableAllPeers(t *testing.T) {
	self, _ := GenerateIdentity()
	pt := NewPeerTable(self.NodeID)

	for i := 0; i < 5; i++ {
		p, _ := GenerateIdentity()
		pt.AddPeer(PeerInfo{NodeID: p.NodeID, PublicKey: p.PublicKey})
	}

	all := pt.AllPeers()
	if len(all) != 5 {
		t.Errorf("AllPeers: got %d, want 5", len(all))
	}
}
