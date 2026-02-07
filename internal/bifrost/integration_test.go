package bifrost_test

import (
	"bytes"
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/valhalla/valhalla/internal/bifrost"
	"github.com/valhalla/valhalla/internal/types"
)

func TestTCPTransport1000Frames(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	transport := bifrost.NewTCPTransport()
	ln, err := transport.Listen(ctx, "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Listen: %v", err)
	}
	defer ln.Close()

	const numFrames = 1000
	var wg sync.WaitGroup
	errc := make(chan error, 2)

	// Server: accept one connection, receive numFrames frames
	received := make([]*types.BifrostFrame, 0, numFrames)
	wg.Add(1)
	go func() {
		defer wg.Done()
		conn, err := ln.Accept(ctx)
		if err != nil {
			errc <- fmt.Errorf("accept: %w", err)
			return
		}
		defer conn.Close()

		for i := 0; i < numFrames; i++ {
			frame, err := conn.Receive()
			if err != nil {
				errc <- fmt.Errorf("receive frame %d: %w", i, err)
				return
			}
			received = append(received, frame)
		}
	}()

	// Client: connect and send numFrames frames
	wg.Add(1)
	go func() {
		defer wg.Done()
		conn, err := transport.Dial(ctx, ln.Addr())
		if err != nil {
			errc <- fmt.Errorf("dial: %w", err)
			return
		}
		defer conn.Close()

		for i := 0; i < numFrames; i++ {
			payload := []byte(fmt.Sprintf("frame-%04d", i))
			frame := &types.BifrostFrame{
				Type:    types.FrameData,
				Payload: payload,
			}
			if err := conn.Send(frame); err != nil {
				errc <- fmt.Errorf("send frame %d: %w", i, err)
				return
			}
		}
	}()

	// Wait for completion
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case err := <-errc:
		t.Fatalf("goroutine error: %v", err)
	case <-done:
		// Success
	case <-ctx.Done():
		t.Fatal("test timed out")
	}

	// Verify all frames received correctly
	if len(received) != numFrames {
		t.Fatalf("received %d frames, want %d", len(received), numFrames)
	}

	for i, frame := range received {
		if frame.Type != types.FrameData {
			t.Errorf("frame %d: type %v, want DATA", i, frame.Type)
		}
		expected := []byte(fmt.Sprintf("frame-%04d", i))
		if !bytes.Equal(frame.Payload, expected) {
			t.Errorf("frame %d: payload %q, want %q", i, frame.Payload, expected)
		}
	}
}

func TestTCPTransportFrameTypes(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	transport := bifrost.NewTCPTransport()
	ln, err := transport.Listen(ctx, "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Listen: %v", err)
	}
	defer ln.Close()

	frameTypes := []types.FrameType{
		types.FrameData,
		types.FrameControl,
		types.FrameKeepalive,
		types.FrameClose,
	}

	errc := make(chan error, 2)
	received := make(chan *types.BifrostFrame, len(frameTypes))

	go func() {
		conn, err := ln.Accept(ctx)
		if err != nil {
			errc <- err
			return
		}
		defer conn.Close()
		for range frameTypes {
			f, err := conn.Receive()
			if err != nil {
				errc <- err
				return
			}
			received <- f
		}
	}()

	go func() {
		conn, err := transport.Dial(ctx, ln.Addr())
		if err != nil {
			errc <- err
			return
		}
		defer conn.Close()
		for _, ft := range frameTypes {
			if err := conn.Send(&types.BifrostFrame{Type: ft, Payload: []byte(ft.String())}); err != nil {
				errc <- err
				return
			}
		}
	}()

	for i, wantType := range frameTypes {
		select {
		case f := <-received:
			if f.Type != wantType {
				t.Errorf("frame %d: got type %v, want %v", i, f.Type, wantType)
			}
		case err := <-errc:
			t.Fatalf("error: %v", err)
		case <-ctx.Done():
			t.Fatal("timeout")
		}
	}
}
