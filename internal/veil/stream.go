package veil

import (
	"encoding/binary"
	"fmt"
	"sync"
	"sync/atomic"
)

// Stream represents a multiplexed stream over an encrypted connection.
type Stream struct {
	ID       uint32
	conn     *EncryptedConn
	recvCh   chan []byte
	closed   atomic.Bool
}

// Write sends data on this stream.
func (s *Stream) Write(data []byte) error {
	if s.closed.Load() {
		return fmt.Errorf("veil: stream %d closed", s.ID)
	}

	// Prepend stream header: [streamID:4][length:4][payload]
	header := make([]byte, 8+len(data))
	binary.BigEndian.PutUint32(header[0:4], s.ID)
	binary.BigEndian.PutUint32(header[4:8], uint32(len(data)))
	copy(header[8:], data)

	return s.conn.Send(header)
}

// Read receives data from this stream (blocks until data arrives).
func (s *Stream) Read() ([]byte, error) {
	data, ok := <-s.recvCh
	if !ok {
		return nil, fmt.Errorf("veil: stream %d closed", s.ID)
	}
	return data, nil
}

// Close marks this stream as closed.
func (s *Stream) Close() {
	s.closed.Store(true)
	// Don't close recvCh here; the mux handles that
}

// StreamMux multiplexes multiple streams over a single encrypted connection.
type StreamMux struct {
	conn     *EncryptedConn
	streams  map[uint32]*Stream
	nextID   atomic.Uint32
	mu       sync.RWMutex
	done     chan struct{}
}

// NewStreamMux creates a stream multiplexer over an encrypted connection.
func NewStreamMux(conn *EncryptedConn) *StreamMux {
	mux := &StreamMux{
		conn:    conn,
		streams: make(map[uint32]*Stream),
		done:    make(chan struct{}),
	}
	go mux.readLoop()
	return mux
}

// OpenStream creates a new multiplexed stream.
func (m *StreamMux) OpenStream() *Stream {
	id := m.nextID.Add(1)
	s := &Stream{
		ID:     id,
		conn:   m.conn,
		recvCh: make(chan []byte, 64),
	}
	m.mu.Lock()
	m.streams[id] = s
	m.mu.Unlock()
	return s
}

// GetOrCreateStream returns an existing stream or creates one.
func (m *StreamMux) GetOrCreateStream(id uint32) *Stream {
	m.mu.Lock()
	defer m.mu.Unlock()

	if s, ok := m.streams[id]; ok {
		return s
	}
	s := &Stream{
		ID:     id,
		conn:   m.conn,
		recvCh: make(chan []byte, 64),
	}
	m.streams[id] = s
	return s
}

// readLoop reads encrypted frames and demuxes them to streams.
func (m *StreamMux) readLoop() {
	defer close(m.done)

	for {
		data, err := m.conn.Receive()
		if err != nil {
			return
		}

		if len(data) < 8 {
			continue // malformed
		}

		streamID := binary.BigEndian.Uint32(data[0:4])
		payloadLen := binary.BigEndian.Uint32(data[4:8])

		if int(payloadLen) > len(data)-8 {
			continue // truncated
		}
		payload := data[8 : 8+payloadLen]

		stream := m.GetOrCreateStream(streamID)
		select {
		case stream.recvCh <- payload:
		default:
			// Drop if channel full (backpressure)
		}
	}
}

// Close shuts down the mux and all streams.
func (m *StreamMux) Close() error {
	// Close the underlying connection first — this causes readLoop to exit.
	err := m.conn.Close()

	// Wait for readLoop to finish before touching stream channels.
	<-m.done

	m.mu.Lock()
	for _, s := range m.streams {
		s.Close()
		close(s.recvCh)
	}
	m.streams = nil
	m.mu.Unlock()

	return err
}

// Done returns a channel that's closed when the read loop exits.
func (m *StreamMux) Done() <-chan struct{} {
	return m.done
}
