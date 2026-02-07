package veil

import (
	"context"
	"fmt"
	"net"
	"sync"

	"github.com/valhalla/valhalla/internal/types"
)

// ConnectionManager manages encrypted connections to peers.
type ConnectionManager struct {
	localKey *NoiseKeypair
	conns    sync.Map // types.NodeID -> *StreamMux
	events   chan<- types.StackEvent
}

// NewConnectionManager creates a new connection manager.
func NewConnectionManager(localKey *NoiseKeypair, events chan<- types.StackEvent) *ConnectionManager {
	return &ConnectionManager{
		localKey: localKey,
		events:   events,
	}
}

// GetOrDial returns an existing connection or establishes a new one.
func (cm *ConnectionManager) GetOrDial(ctx context.Context, nodeID types.NodeID, addr string) (*StreamMux, error) {
	// Check for existing connection
	if mux, ok := cm.conns.Load(nodeID); ok {
		return mux.(*StreamMux), nil
	}

	// Dial and handshake
	var d net.Dialer
	rawConn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("veil: dial %s: %w", addr, err)
	}

	hs, err := PerformHandshakeInitiator(rawConn, cm.localKey)
	if err != nil {
		rawConn.Close()
		return nil, fmt.Errorf("veil: handshake with %s: %w", addr, err)
	}

	encConn := NewEncryptedConn(rawConn, hs)
	mux := NewStreamMux(encConn)

	cm.conns.Store(nodeID, mux)

	cm.emitEvent("connection_established", map[string]string{
		"peer": nodeID.Short(),
		"addr": addr,
	})

	return mux, nil
}

// AcceptConnection handles an incoming connection.
func (cm *ConnectionManager) AcceptConnection(rawConn net.Conn) (*StreamMux, []byte, error) {
	hs, err := PerformHandshakeResponder(rawConn, cm.localKey)
	if err != nil {
		rawConn.Close()
		return nil, nil, fmt.Errorf("veil: responder handshake: %w", err)
	}

	encConn := NewEncryptedConn(rawConn, hs)
	mux := NewStreamMux(encConn)

	return mux, hs.RemoteKey, nil
}

// RegisterMux registers a StreamMux for a known peer.
func (cm *ConnectionManager) RegisterMux(nodeID types.NodeID, mux *StreamMux) {
	cm.conns.Store(nodeID, mux)
}

// Remove removes a peer connection.
func (cm *ConnectionManager) Remove(nodeID types.NodeID) {
	if mux, ok := cm.conns.LoadAndDelete(nodeID); ok {
		mux.(*StreamMux).Close()
	}
}

func (cm *ConnectionManager) emitEvent(eventType string, data interface{}) {
	if cm.events != nil {
		select {
		case cm.events <- types.StackEvent{Layer: "veil", Type: eventType, Data: data}:
		default:
		}
	}
}
