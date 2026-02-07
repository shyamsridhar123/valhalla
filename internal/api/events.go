package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/valhalla/valhalla/internal/types"
	"nhooyr.io/websocket"
)

// EventHub fans out stack events to all connected WebSocket clients.
type EventHub struct {
	mu      sync.RWMutex
	clients map[*wsClient]struct{}
	closed  bool
}

type wsClient struct {
	conn *websocket.Conn
	send chan []byte
	done chan struct{}
}

// NewEventHub creates a new event hub.
func NewEventHub() *EventHub {
	return &EventHub{
		clients: make(map[*wsClient]struct{}),
	}
}

// Broadcast sends an event to all connected clients.
func (h *EventHub) Broadcast(evt types.StackEvent) {
	data, err := json.Marshal(evt)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		select {
		case client.send <- data:
		default:
			// Drop if client is slow (backpressure)
		}
	}
}

// Close shuts down all client connections.
func (h *EventHub) Close() {
	h.mu.Lock()
	h.closed = true
	for client := range h.clients {
		close(client.send)
	}
	h.clients = nil
	h.mu.Unlock()
}

// ServeHTTP upgrades the connection to WebSocket and adds it to the hub.
func (h *EventHub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true, // Allow any origin for PoC
	})
	if err != nil {
		log.Printf("websocket accept: %v", err)
		return
	}

	client := &wsClient{
		conn: conn,
		send: make(chan []byte, 256),
		done: make(chan struct{}),
	}

	h.mu.Lock()
	if h.closed {
		h.mu.Unlock()
		conn.Close(websocket.StatusGoingAway, "server shutting down")
		return
	}
	h.clients[client] = struct{}{}
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.clients, client)
		h.mu.Unlock()
		conn.Close(websocket.StatusNormalClosure, "")
	}()

	// Write loop: send events to this client.
	for data := range client.send {
		err := conn.Write(r.Context(), websocket.MessageText, data)
		if err != nil {
			return
		}
	}
}
