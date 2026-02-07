package demo_test

import (
	"context"
	"testing"
	"time"

	"github.com/valhalla/valhalla/internal/demo"
)

func TestNetworkCreation(t *testing.T) {
	net, err := demo.NewNetwork(6, 19001)
	if err != nil {
		t.Fatalf("NewNetwork: %v", err)
	}

	if net.Size() != 6 {
		t.Fatalf("Size: got %d, want 6", net.Size())
	}

	// Every node should be connected to every other
	for i, nd := range net.Nodes {
		peers := nd.Peers()
		if len(peers) != 5 {
			t.Errorf("node %d: got %d peers, want 5", i, len(peers))
		}
	}

	// NodeByIndex bounds check
	if net.NodeByIndex(-1) != nil {
		t.Error("should return nil for negative index")
	}
	if net.NodeByIndex(6) != nil {
		t.Error("should return nil for out-of-bounds index")
	}

	// NodeByID
	node0 := net.NodeByIndex(0)
	found := net.NodeByID(node0.NodeID())
	if found != node0 {
		t.Error("NodeByID should find node 0")
	}
}

func TestAllScenariosRun(t *testing.T) {
	net, err := demo.NewNetwork(6, 19101)
	if err != nil {
		t.Fatalf("NewNetwork: %v", err)
	}

	scenarios := demo.AllScenarios()
	if len(scenarios) != 6 {
		t.Fatalf("expected 6 scenarios, got %d", len(scenarios))
	}

	for _, sc := range scenarios {
		t.Run(sc.Name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			var narrations []string
			narrate := func(msg string) {
				narrations = append(narrations, msg)
			}

			err := sc.Run(ctx, net, narrate)
			if err != nil {
				t.Fatalf("scenario %s failed: %v", sc.Name, err)
			}

			if len(narrations) == 0 {
				t.Errorf("scenario %s produced no narration", sc.Name)
			}

			t.Logf("scenario %s: %d narration lines", sc.Name, len(narrations))
		})
	}
}

func TestNodeInfoSerialization(t *testing.T) {
	net, err := demo.NewNetwork(2, 19201)
	if err != nil {
		t.Fatalf("NewNetwork: %v", err)
	}

	infos := net.GetAllNodeInfo()
	if len(infos) != 2 {
		t.Fatalf("GetAllNodeInfo: got %d, want 2", len(infos))
	}

	for _, info := range infos {
		if info.NodeID == "" {
			t.Error("empty NodeID")
		}
		if info.ShortID == "" {
			t.Error("empty ShortID")
		}
		if info.Address == "" {
			t.Error("empty Address")
		}
		if info.PeerCount != 1 {
			t.Errorf("PeerCount: got %d, want 1", info.PeerCount)
		}
	}
}
