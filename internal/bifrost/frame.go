// Package bifrost implements Layer 1 (Bridge) of the Valhalla stack.
// It provides framing and transport abstraction over existing networks.
package bifrost

import (
	"bufio"
	"encoding/binary"
	"errors"
	"fmt"
	"io"

	"github.com/valhalla/valhalla/internal/types"
)

var (
	ErrInvalidMagic   = errors.New("bifrost: invalid magic bytes")
	ErrPayloadTooLong = errors.New("bifrost: payload exceeds maximum size")
)

// MaxPayloadSize is the maximum allowed payload in a single frame (16 MB).
const MaxPayloadSize = 16 * 1024 * 1024

// Encode writes a BifrostFrame to a buffered writer.
func Encode(w *bufio.Writer, f *types.BifrostFrame) error {
	// Magic bytes
	if _, err := w.Write(types.BifrostMagic[:]); err != nil {
		return fmt.Errorf("bifrost encode magic: %w", err)
	}
	// Payload length (4 bytes, big-endian)
	var lenBuf [4]byte
	binary.BigEndian.PutUint32(lenBuf[:], uint32(len(f.Payload)))
	if _, err := w.Write(lenBuf[:]); err != nil {
		return fmt.Errorf("bifrost encode length: %w", err)
	}
	// Frame type
	if err := w.WriteByte(byte(f.Type)); err != nil {
		return fmt.Errorf("bifrost encode type: %w", err)
	}
	// Payload
	if len(f.Payload) > 0 {
		if _, err := w.Write(f.Payload); err != nil {
			return fmt.Errorf("bifrost encode payload: %w", err)
		}
	}
	return w.Flush()
}

// Decode reads a BifrostFrame from a buffered reader.
func Decode(r *bufio.Reader) (*types.BifrostFrame, error) {
	// Read magic bytes
	var magic [2]byte
	if _, err := io.ReadFull(r, magic[:]); err != nil {
		return nil, fmt.Errorf("bifrost decode magic: %w", err)
	}
	if magic != types.BifrostMagic {
		return nil, ErrInvalidMagic
	}

	// Read payload length
	var lenBuf [4]byte
	if _, err := io.ReadFull(r, lenBuf[:]); err != nil {
		return nil, fmt.Errorf("bifrost decode length: %w", err)
	}
	payloadLen := binary.BigEndian.Uint32(lenBuf[:])
	if payloadLen > MaxPayloadSize {
		return nil, ErrPayloadTooLong
	}

	// Read frame type
	typeByte, err := r.ReadByte()
	if err != nil {
		return nil, fmt.Errorf("bifrost decode type: %w", err)
	}

	// Read payload
	var payload []byte
	if payloadLen > 0 {
		payload = make([]byte, payloadLen)
		if _, err := io.ReadFull(r, payload); err != nil {
			return nil, fmt.Errorf("bifrost decode payload: %w", err)
		}
	}

	return &types.BifrostFrame{
		Type:    types.FrameType(typeByte),
		Payload: payload,
	}, nil
}
