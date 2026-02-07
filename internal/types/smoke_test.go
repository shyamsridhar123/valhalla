package types_test

import (
	"context"
	"fmt"
	"net"
	"testing"
	"time"
)

// TestTCPGoroutineExchange verifies that two goroutines can exchange
// a message over a TCP connection on localhost — the Phase 0 smoke test.
func TestTCPGoroutineExchange(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()

	addr := ln.Addr().String()
	want := "Hello from Valhalla"
	got := make(chan string, 1)
	errc := make(chan error, 2)

	// Server goroutine: accept one connection and read the message
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			errc <- fmt.Errorf("accept: %w", err)
			return
		}
		defer conn.Close()

		buf := make([]byte, 256)
		n, err := conn.Read(buf)
		if err != nil {
			errc <- fmt.Errorf("read: %w", err)
			return
		}
		got <- string(buf[:n])
	}()

	// Client goroutine: connect and send the message
	go func() {
		conn, err := net.Dial("tcp", addr)
		if err != nil {
			errc <- fmt.Errorf("dial: %w", err)
			return
		}
		defer conn.Close()

		if _, err := conn.Write([]byte(want)); err != nil {
			errc <- fmt.Errorf("write: %w", err)
		}
	}()

	select {
	case msg := <-got:
		if msg != want {
			t.Errorf("message mismatch: got %q, want %q", msg, want)
		}
	case err := <-errc:
		t.Fatalf("goroutine error: %v", err)
	case <-ctx.Done():
		t.Fatal("test timed out")
	}
}
