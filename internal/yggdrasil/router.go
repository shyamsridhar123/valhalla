package yggdrasil

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/valhalla/valhalla/internal/bifrost"
	"github.com/valhalla/valhalla/internal/types"
)

// Message is a routed message in the Yggdrasil layer.
type Message struct {
	Type    types.ProtocolMessageType `json:"type"`
	From    types.NodeID              `json:"from"`
	To      types.NodeID              `json:"to"`
	Payload []byte                    `json:"payload"`
	TTL     int                       `json:"ttl"`
}

// Router handles message routing between Valhalla nodes.
type Router struct {
	identity  *Identity
	peers     *PeerTable
	dht       *DHT
	conns     map[types.NodeID]bifrost.Conn
	handlers  map[types.ProtocolMessageType]MessageHandler
	events    chan<- types.StackEvent
	mu        sync.RWMutex
}

// MessageHandler processes an incoming routed message.
type MessageHandler func(msg *Message) (*Message, error)

// NewRouter creates a new message router.
func NewRouter(identity *Identity, peers *PeerTable, dht *DHT, events chan<- types.StackEvent) *Router {
	return &Router{
		identity: identity,
		peers:    peers,
		dht:      dht,
		conns:    make(map[types.NodeID]bifrost.Conn),
		handlers: make(map[types.ProtocolMessageType]MessageHandler),
		events:   events,
	}
}

// RegisterHandler registers a handler for a protocol message type.
func (r *Router) RegisterHandler(msgType types.ProtocolMessageType, handler MessageHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[msgType] = handler
}

// AddConnection registers a direct connection to a peer.
func (r *Router) AddConnection(nodeID types.NodeID, conn bifrost.Conn) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.conns[nodeID] = conn
}

// RemoveConnection removes a peer connection.
func (r *Router) RemoveConnection(nodeID types.NodeID) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.conns, nodeID)
}

// GetConnection returns a direct connection to a peer if one exists.
func (r *Router) GetConnection(nodeID types.NodeID) (bifrost.Conn, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	conn, ok := r.conns[nodeID]
	return conn, ok
}

// SendMessage routes a message to its destination.
func (r *Router) SendMessage(ctx context.Context, msg *Message) error {
	if msg.TTL <= 0 {
		msg.TTL = 10 // default TTL
	}
	msg.From = r.identity.NodeID

	r.emitEvent("route_start", map[string]string{
		"to": msg.To.Short(),
	})

	// Direct delivery if we have a connection to the target
	if conn, ok := r.GetConnection(msg.To); ok {
		return r.sendViaConn(conn, msg)
	}

	// Find closest peers to forward through
	closest := r.peers.FindClosest(msg.To, 3)
	if len(closest) == 0 {
		return fmt.Errorf("yggdrasil: no route to %s", msg.To.Short())
	}

	// Forward to the closest known peer
	for _, peer := range closest {
		if conn, ok := r.GetConnection(peer.NodeID); ok {
			// Decrement TTL for forwarding
			forward := *msg
			forward.TTL--
			if forward.TTL <= 0 {
				return fmt.Errorf("yggdrasil: TTL expired routing to %s", msg.To.Short())
			}

			r.emitEvent("route_forward", map[string]string{
				"via": peer.NodeID.Short(),
				"to":  msg.To.Short(),
			})

			return r.sendViaConn(conn, &forward)
		}
	}

	return fmt.Errorf("yggdrasil: no connected peers near %s", msg.To.Short())
}

// HandleIncoming processes an incoming message from a peer connection.
func (r *Router) HandleIncoming(msg *Message) error {
	// Is this message for us?
	if msg.To == r.identity.NodeID {
		r.emitEvent("message_received", map[string]string{
			"from": msg.From.Short(),
			"type": fmt.Sprintf("%d", msg.Type),
		})

		r.mu.RLock()
		handler, ok := r.handlers[msg.Type]
		r.mu.RUnlock()

		if ok {
			_, err := handler(msg)
			return err
		}
		return nil // no handler, drop silently
	}

	// Forward if TTL allows
	if msg.TTL <= 0 {
		return nil // TTL expired, drop
	}

	forward := *msg
	forward.TTL--
	return r.SendMessage(context.Background(), &forward)
}

func (r *Router) sendViaConn(conn bifrost.Conn, msg *Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("yggdrasil: marshal message: %w", err)
	}

	frame := &types.BifrostFrame{
		Type:    types.FrameData,
		Payload: data,
	}
	return conn.Send(frame)
}

// ReceiveLoop reads frames from a connection and dispatches them as messages.
func (r *Router) ReceiveLoop(ctx context.Context, peerID types.NodeID, conn bifrost.Conn) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		frame, err := conn.Receive()
		if err != nil {
			r.RemoveConnection(peerID)
			return
		}

		if frame.Type != types.FrameData {
			continue // skip non-data frames for now
		}

		var msg Message
		if err := json.Unmarshal(frame.Payload, &msg); err != nil {
			continue // skip malformed messages
		}

		r.HandleIncoming(&msg)
	}
}

func (r *Router) emitEvent(eventType string, data interface{}) {
	if r.events != nil {
		select {
		case r.events <- types.NewStackEvent("yggdrasil", eventType, r.identity.NodeID, data):
		default: // drop if channel full
		}
	}
}
