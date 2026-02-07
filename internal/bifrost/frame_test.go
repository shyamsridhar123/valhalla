package bifrost

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"testing"

	"github.com/valhalla/valhalla/internal/types"
)

func TestFrameRoundtrip(t *testing.T) {
	tests := []struct {
		name  string
		frame types.BifrostFrame
	}{
		{
			name:  "empty data frame",
			frame: types.BifrostFrame{Type: types.FrameData, Payload: nil},
		},
		{
			name:  "data frame with payload",
			frame: types.BifrostFrame{Type: types.FrameData, Payload: []byte("hello valhalla")},
		},
		{
			name:  "control frame",
			frame: types.BifrostFrame{Type: types.FrameControl, Payload: []byte{0x01, 0x02, 0x03}},
		},
		{
			name:  "keepalive frame",
			frame: types.BifrostFrame{Type: types.FrameKeepalive, Payload: nil},
		},
		{
			name:  "close frame",
			frame: types.BifrostFrame{Type: types.FrameClose, Payload: []byte("goodbye")},
		},
		{
			name:  "large payload",
			frame: types.BifrostFrame{Type: types.FrameData, Payload: make([]byte, 64*1024)},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Fill large payloads with random data
			if len(tt.frame.Payload) > 100 {
				rand.Read(tt.frame.Payload)
			}

			var buf bytes.Buffer
			w := bufio.NewWriter(&buf)
			if err := Encode(w, &tt.frame); err != nil {
				t.Fatalf("Encode: %v", err)
			}

			r := bufio.NewReader(&buf)
			got, err := Decode(r)
			if err != nil {
				t.Fatalf("Decode: %v", err)
			}

			if got.Type != tt.frame.Type {
				t.Errorf("Type: got %v, want %v", got.Type, tt.frame.Type)
			}
			if !bytes.Equal(got.Payload, tt.frame.Payload) {
				t.Errorf("Payload mismatch (len got=%d, want=%d)", len(got.Payload), len(tt.frame.Payload))
			}
		})
	}
}

func TestDecodeInvalidMagic(t *testing.T) {
	data := []byte{0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x01}
	r := bufio.NewReader(bytes.NewReader(data))
	_, err := Decode(r)
	if err == nil {
		t.Fatal("expected error for invalid magic bytes")
	}
}

func TestDecodePayloadTooLong(t *testing.T) {
	var buf bytes.Buffer
	buf.Write(types.BifrostMagic[:])
	// Write length > MaxPayloadSize
	lenBuf := make([]byte, 4)
	lenBuf[0] = 0xFF
	lenBuf[1] = 0xFF
	lenBuf[2] = 0xFF
	lenBuf[3] = 0xFF
	buf.Write(lenBuf)
	buf.WriteByte(byte(types.FrameData))

	r := bufio.NewReader(&buf)
	_, err := Decode(r)
	if err == nil {
		t.Fatal("expected error for oversized payload")
	}
}

func TestMultipleFramesSequential(t *testing.T) {
	var buf bytes.Buffer
	w := bufio.NewWriter(&buf)

	frames := []types.BifrostFrame{
		{Type: types.FrameData, Payload: []byte("first")},
		{Type: types.FrameControl, Payload: []byte("second")},
		{Type: types.FrameKeepalive, Payload: nil},
		{Type: types.FrameData, Payload: []byte("fourth")},
	}

	for i := range frames {
		if err := Encode(w, &frames[i]); err != nil {
			t.Fatalf("Encode frame %d: %v", i, err)
		}
	}

	r := bufio.NewReader(&buf)
	for i, want := range frames {
		got, err := Decode(r)
		if err != nil {
			t.Fatalf("Decode frame %d: %v", i, err)
		}
		if got.Type != want.Type {
			t.Errorf("frame %d type: got %v, want %v", i, got.Type, want.Type)
		}
		if !bytes.Equal(got.Payload, want.Payload) {
			t.Errorf("frame %d payload mismatch", i)
		}
	}
}
