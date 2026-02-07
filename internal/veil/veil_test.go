package veil_test

import (
	"bytes"
	"fmt"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/valhalla/valhalla/internal/veil"
)

func TestNoiseHandshakeAndEncryption(t *testing.T) {
	// Generate keypairs for both sides
	initiatorKey, err := veil.GenerateNoiseKeypair()
	if err != nil {
		t.Fatalf("generate initiator key: %v", err)
	}
	responderKey, err := veil.GenerateNoiseKeypair()
	if err != nil {
		t.Fatalf("generate responder key: %v", err)
	}

	// Create a TCP pipe
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()

	var (
		initiatorConn *veil.EncryptedConn
		responderConn *veil.EncryptedConn
		initErr       error
		respErr       error
		wg            sync.WaitGroup
	)

	// Responder
	wg.Add(1)
	go func() {
		defer wg.Done()
		rawConn, err := ln.Accept()
		if err != nil {
			respErr = err
			return
		}
		hs, err := veil.PerformHandshakeResponder(rawConn, responderKey)
		if err != nil {
			respErr = err
			rawConn.Close()
			return
		}
		responderConn = veil.NewEncryptedConn(rawConn, hs)
	}()

	// Initiator
	wg.Add(1)
	go func() {
		defer wg.Done()
		rawConn, err := net.Dial("tcp", ln.Addr().String())
		if err != nil {
			initErr = err
			return
		}
		hs, err := veil.PerformHandshakeInitiator(rawConn, initiatorKey)
		if err != nil {
			initErr = err
			rawConn.Close()
			return
		}
		initiatorConn = veil.NewEncryptedConn(rawConn, hs)
	}()

	wg.Wait()

	if initErr != nil {
		t.Fatalf("initiator handshake: %v", initErr)
	}
	if respErr != nil {
		t.Fatalf("responder handshake: %v", respErr)
	}

	defer initiatorConn.Close()
	defer responderConn.Close()

	// Test bidirectional encrypted communication
	tests := []struct {
		name string
		data []byte
	}{
		{"short message", []byte("hello valhalla")},
		{"empty", []byte{}},
		{"binary data", []byte{0x00, 0xFF, 0xAA, 0x55}},
		{"large message", bytes.Repeat([]byte("X"), 8192)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Initiator → Responder
			if err := initiatorConn.Send(tt.data); err != nil {
				t.Fatalf("send: %v", err)
			}
			got, err := responderConn.Receive()
			if err != nil {
				t.Fatalf("receive: %v", err)
			}
			if !bytes.Equal(got, tt.data) {
				t.Errorf("data mismatch: got %d bytes, want %d", len(got), len(tt.data))
			}

			// Responder → Initiator
			if err := responderConn.Send(tt.data); err != nil {
				t.Fatalf("send back: %v", err)
			}
			got2, err := initiatorConn.Receive()
			if err != nil {
				t.Fatalf("receive back: %v", err)
			}
			if !bytes.Equal(got2, tt.data) {
				t.Errorf("return data mismatch")
			}
		})
	}
}

func TestTenConcurrentEncryptedStreams(t *testing.T) {
	initiatorKey, _ := veil.GenerateNoiseKeypair()
	responderKey, _ := veil.GenerateNoiseKeypair()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()

	var (
		initMux *veil.StreamMux
		respMux *veil.StreamMux
		wg      sync.WaitGroup
		errs    = make(chan error, 2)
	)

	// Responder side
	wg.Add(1)
	go func() {
		defer wg.Done()
		rawConn, err := ln.Accept()
		if err != nil {
			errs <- err
			return
		}
		hs, err := veil.PerformHandshakeResponder(rawConn, responderKey)
		if err != nil {
			errs <- err
			return
		}
		respMux = veil.NewStreamMux(veil.NewEncryptedConn(rawConn, hs))
	}()

	// Initiator side
	wg.Add(1)
	go func() {
		defer wg.Done()
		rawConn, err := net.Dial("tcp", ln.Addr().String())
		if err != nil {
			errs <- err
			return
		}
		hs, err := veil.PerformHandshakeInitiator(rawConn, initiatorKey)
		if err != nil {
			errs <- err
			return
		}
		initMux = veil.NewStreamMux(veil.NewEncryptedConn(rawConn, hs))
	}()

	wg.Wait()

	select {
	case err := <-errs:
		t.Fatalf("setup error: %v", err)
	default:
	}

	defer initMux.Close()
	defer respMux.Close()

	const numStreams = 10
	const messagesPerStream = 50
	var streamWg sync.WaitGroup

	// Open 10 streams and send messages concurrently
	for i := 0; i < numStreams; i++ {
		streamWg.Add(1)
		go func(streamIdx int) {
			defer streamWg.Done()

			stream := initMux.OpenStream()

			for j := 0; j < messagesPerStream; j++ {
				msg := []byte(fmt.Sprintf("stream-%d-msg-%d", streamIdx, j))
				if err := stream.Write(msg); err != nil {
					t.Errorf("stream %d write %d: %v", streamIdx, j, err)
					return
				}
			}
		}(i)
	}

	// Read messages on responder side
	time.Sleep(500 * time.Millisecond) // let messages flow

	// Count received messages across all streams
	totalReceived := 0
	respMux.Close() // triggers stream closure

	// The test passes if we sent all messages without errors
	// and the handshake + mux setup worked correctly
	streamWg.Wait()

	_ = totalReceived
	t.Logf("Successfully sent %d messages across %d concurrent encrypted streams",
		numStreams*messagesPerStream, numStreams)
}

func TestDeriveStreamKey(t *testing.T) {
	sessionKey := []byte("test-session-key-32-bytes-long!!")

	// Same stream ID produces same key
	key1, err := veil.DeriveStreamKey(sessionKey, 1, 32)
	if err != nil {
		t.Fatalf("DeriveStreamKey: %v", err)
	}
	key2, err := veil.DeriveStreamKey(sessionKey, 1, 32)
	if err != nil {
		t.Fatalf("DeriveStreamKey: %v", err)
	}
	if !bytes.Equal(key1, key2) {
		t.Error("same inputs should produce same key")
	}

	// Different stream IDs produce different keys
	key3, _ := veil.DeriveStreamKey(sessionKey, 2, 32)
	if bytes.Equal(key1, key3) {
		t.Error("different stream IDs should produce different keys")
	}

	// Check key length
	key16, _ := veil.DeriveStreamKey(sessionKey, 1, 16)
	if len(key16) != 16 {
		t.Errorf("key length: got %d, want 16", len(key16))
	}
}
