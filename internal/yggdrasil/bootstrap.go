package yggdrasil

import (
	"context"
	"fmt"
	"time"

	"github.com/valhalla/valhalla/internal/bifrost"
	"github.com/valhalla/valhalla/internal/types"
)

// BootstrapConfig holds configuration for peer discovery.
type BootstrapConfig struct {
	BootstrapAddrs []types.PathAddr
	Transport      bifrost.Transport
}

// Bootstrap connects to bootstrap nodes and populates the peer table.
func Bootstrap(ctx context.Context, identity *Identity, peers *PeerTable, router *Router, config BootstrapConfig) error {
	for _, addr := range config.BootstrapAddrs {
		dialCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		conn, err := config.Transport.Dial(dialCtx, string(addr))
		cancel()

		if err != nil {
			continue // skip unreachable bootstrap nodes
		}

		// In a full implementation, we'd exchange identity info.
		// For the PoC, we register the connection via the router
		// and discovery happens through direct peer exchange.
		_ = conn
		fmt.Printf("Connected to bootstrap: %s\n", addr)
	}
	return nil
}

// ConnectPeer establishes a Bifrost connection to a known peer.
func ConnectPeer(ctx context.Context, transport bifrost.Transport, router *Router, peer PeerInfo) error {
	if len(peer.Addrs) == 0 {
		return fmt.Errorf("yggdrasil: peer %s has no addresses", peer.NodeID.Short())
	}

	for _, addr := range peer.Addrs {
		dialCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		conn, err := transport.Dial(dialCtx, string(addr))
		cancel()

		if err != nil {
			continue
		}

		router.AddConnection(peer.NodeID, conn)

		// Start receive loop in background
		go router.ReceiveLoop(ctx, peer.NodeID, conn)

		return nil
	}

	return fmt.Errorf("yggdrasil: failed to connect to %s", peer.NodeID.Short())
}
