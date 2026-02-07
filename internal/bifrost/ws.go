package bifrost

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"github.com/valhalla/valhalla/internal/types"
	"nhooyr.io/websocket"
)

// WSTransport implements Transport over WebSocket.
type WSTransport struct{}

// NewWSTransport creates a new WebSocket transport.
func NewWSTransport() *WSTransport {
	return &WSTransport{}
}

// Listen starts an HTTP server that upgrades connections to WebSocket.
func (t *WSTransport) Listen(ctx context.Context, addr string) (Listener, error) {
	l := &wsListener{
		addr:   addr,
		connCh: make(chan *wsConn, 16),
		done:   make(chan struct{}),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			InsecureSkipVerify: true, // PoC only
		})
		if err != nil {
			return
		}
		wc := &wsConn{
			conn:       c,
			ctx:        r.Context(),
			remoteAddr: func() string { return r.RemoteAddr },
		}
		select {
		case l.connCh <- wc:
		case <-l.done:
			c.Close(websocket.StatusGoingAway, "listener closed")
		}
	})

	l.server = &http.Server{Addr: addr, Handler: mux}
	go func() {
		if err := l.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			// Log error in production; for PoC we silently ignore
		}
	}()

	return l, nil
}

// Dial connects to a WebSocket server.
func (t *WSTransport) Dial(ctx context.Context, addr string) (Conn, error) {
	url := fmt.Sprintf("ws://%s/", addr)
	c, _, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		return nil, fmt.Errorf("bifrost ws dial: %w", err)
	}
	return &wsConn{conn: c, ctx: ctx, remoteAddr: func() string { return addr }}, nil
}

type wsListener struct {
	addr   string
	server *http.Server
	connCh chan *wsConn
	done   chan struct{}
}

func (l *wsListener) Accept(ctx context.Context) (Conn, error) {
	select {
	case c := <-l.connCh:
		return c, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-l.done:
		return nil, fmt.Errorf("bifrost ws listener closed")
	}
}

func (l *wsListener) Addr() string { return l.addr }

func (l *wsListener) Close() error {
	close(l.done)
	return l.server.Close()
}

// wsConn wraps a websocket.Conn as a Bifrost Conn.
// Each frame is sent as a single WebSocket binary message.
type wsConn struct {
	conn       *websocket.Conn
	ctx        context.Context
	remoteAddr func() string
	mu         sync.Mutex
}

func (c *wsConn) Send(frame *types.BifrostFrame) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	data, err := frame.MarshalBinary()
	if err != nil {
		return err
	}
	return c.conn.Write(c.ctx, websocket.MessageBinary, data)
}

func (c *wsConn) Receive() (*types.BifrostFrame, error) {
	_, data, err := c.conn.Read(c.ctx)
	if err != nil {
		return nil, fmt.Errorf("bifrost ws receive: %w", err)
	}

	if len(data) < types.BifrostFrameHeaderSize {
		return nil, fmt.Errorf("bifrost ws: message too short (%d bytes)", len(data))
	}
	if data[0] != types.BifrostMagic[0] || data[1] != types.BifrostMagic[1] {
		return nil, ErrInvalidMagic
	}

	return &types.BifrostFrame{
		Type:    types.FrameType(data[6]),
		Payload: data[types.BifrostFrameHeaderSize:],
	}, nil
}

func (c *wsConn) RemoteAddr() string {
	if c.remoteAddr != nil {
		return c.remoteAddr()
	}
	return "unknown"
}

func (c *wsConn) Close() error {
	return c.conn.Close(websocket.StatusNormalClosure, "")
}
