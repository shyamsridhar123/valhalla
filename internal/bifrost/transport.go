package bifrost

import (
	"context"

	"github.com/valhalla/valhalla/internal/types"
)

// Transport is the pluggable transport abstraction for Bifrost.
type Transport interface {
	// Listen starts accepting connections on the given address.
	Listen(ctx context.Context, addr string) (Listener, error)

	// Dial connects to a remote address.
	Dial(ctx context.Context, addr string) (Conn, error)
}

// Listener accepts incoming Bifrost connections.
type Listener interface {
	// Accept blocks until a new connection is available.
	Accept(ctx context.Context) (Conn, error)

	// Addr returns the listener's address.
	Addr() string

	// Close stops the listener.
	Close() error
}

// Conn is a framed connection that sends and receives BifrostFrames.
type Conn interface {
	// Send writes a frame to the connection.
	Send(frame *types.BifrostFrame) error

	// Receive reads the next frame from the connection.
	Receive() (*types.BifrostFrame, error)

	// RemoteAddr returns the remote address.
	RemoteAddr() string

	// Close closes the connection.
	Close() error
}
