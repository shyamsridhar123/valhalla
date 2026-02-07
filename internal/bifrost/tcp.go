package bifrost

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"sync"

	"github.com/valhalla/valhalla/internal/types"
)

// TCPTransport implements Transport over TCP.
type TCPTransport struct{}

// NewTCPTransport creates a new TCP transport.
func NewTCPTransport() *TCPTransport {
	return &TCPTransport{}
}

// Listen starts a TCP listener on the given address.
func (t *TCPTransport) Listen(ctx context.Context, addr string) (Listener, error) {
	lc := net.ListenConfig{}
	ln, err := lc.Listen(ctx, "tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("bifrost tcp listen: %w", err)
	}
	return &tcpListener{ln: ln}, nil
}

// Dial connects to a TCP address.
func (t *TCPTransport) Dial(ctx context.Context, addr string) (Conn, error) {
	var d net.Dialer
	conn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("bifrost tcp dial: %w", err)
	}
	return newTCPConn(conn), nil
}

type tcpListener struct {
	ln net.Listener
}

func (l *tcpListener) Accept(ctx context.Context) (Conn, error) {
	// Use a goroutine to respect context cancellation
	type result struct {
		conn net.Conn
		err  error
	}
	ch := make(chan result, 1)
	go func() {
		c, err := l.ln.Accept()
		ch <- result{c, err}
	}()

	select {
	case res := <-ch:
		if res.err != nil {
			return nil, fmt.Errorf("bifrost tcp accept: %w", res.err)
		}
		return newTCPConn(res.conn), nil
	case <-ctx.Done():
		l.ln.Close()
		return nil, ctx.Err()
	}
}

func (l *tcpListener) Addr() string {
	return l.ln.Addr().String()
}

func (l *tcpListener) Close() error {
	return l.ln.Close()
}

// tcpConn wraps a net.Conn with buffered Bifrost frame encoding/decoding.
type tcpConn struct {
	conn   net.Conn
	reader *bufio.Reader
	writer *bufio.Writer
	mu     sync.Mutex // protects writer
}

func newTCPConn(conn net.Conn) *tcpConn {
	return &tcpConn{
		conn:   conn,
		reader: bufio.NewReaderSize(conn, 64*1024),
		writer: bufio.NewWriterSize(conn, 64*1024),
	}
}

func (c *tcpConn) Send(frame *types.BifrostFrame) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return Encode(c.writer, frame)
}

func (c *tcpConn) Receive() (*types.BifrostFrame, error) {
	return Decode(c.reader)
}

func (c *tcpConn) RemoteAddr() string {
	return c.conn.RemoteAddr().String()
}

func (c *tcpConn) Close() error {
	return c.conn.Close()
}
