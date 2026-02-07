package types

import (
	"bytes"
	"crypto/sha256"
	"testing"
)

func TestNodeIDFromPublicKey(t *testing.T) {
	pubKey := []byte("test-public-key-32-bytes-long!!!")
	expected := sha256.Sum256(pubKey)

	got := NodeIDFromPublicKey(pubKey)
	if got != NodeID(expected) {
		t.Errorf("NodeIDFromPublicKey mismatch: got %x, want %x", got, expected)
	}
}

func TestNodeIDString(t *testing.T) {
	var zero NodeID
	s := zero.String()
	if len(s) < 3 {
		t.Errorf("NodeID.String() too short: %q", s)
	}
	if s[:2] != "VH" {
		t.Errorf("NodeID.String() missing VH prefix: %q", s)
	}

	// Non-zero NodeID should produce a longer string
	nid := NodeIDFromPublicKey([]byte("some-key"))
	ns := nid.String()
	if ns[:2] != "VH" {
		t.Errorf("Non-zero NodeID missing VH prefix: %q", ns)
	}
	if len(ns) <= len(s) {
		t.Errorf("Non-zero NodeID string not longer than zero: %q vs %q", ns, s)
	}
}

func TestXORDistance(t *testing.T) {
	tests := []struct {
		name string
		a, b NodeID
	}{
		{
			name: "same nodes have zero distance",
			a:    NodeIDFromPublicKey([]byte("key-a")),
			b:    NodeIDFromPublicKey([]byte("key-a")),
		},
		{
			name: "different nodes have nonzero distance",
			a:    NodeIDFromPublicKey([]byte("key-a")),
			b:    NodeIDFromPublicKey([]byte("key-b")),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dist := XORDistance(tt.a, tt.b)
			if tt.a == tt.b {
				var zero NodeID
				if dist != zero {
					t.Errorf("XOR distance of identical nodes should be zero, got %x", dist)
				}
			} else {
				var zero NodeID
				if dist == zero {
					t.Errorf("XOR distance of different nodes should be nonzero")
				}
			}
			// XOR is symmetric
			dist2 := XORDistance(tt.b, tt.a)
			if dist != dist2 {
				t.Errorf("XOR distance not symmetric")
			}
		})
	}
}

func TestComputeContentID(t *testing.T) {
	data := []byte("hello valhalla")
	cid := ComputeContentID(data)

	if cid[0] != HashAlgoSHA256 {
		t.Errorf("ContentID algo byte: got %x, want %x", cid[0], HashAlgoSHA256)
	}
	if cid[1] != HashLenSHA256 {
		t.Errorf("ContentID length byte: got %d, want %d", cid[1], HashLenSHA256)
	}

	expected := sha256.Sum256(data)
	if !bytes.Equal(cid[2:], expected[:]) {
		t.Errorf("ContentID hash mismatch")
	}

	// Same data produces same CID
	cid2 := ComputeContentID(data)
	if cid != cid2 {
		t.Errorf("ContentID not deterministic")
	}

	// Different data produces different CID
	cid3 := ComputeContentID([]byte("different"))
	if cid == cid3 {
		t.Errorf("Different data produced same ContentID")
	}
}

func TestBifrostFrameMarshal(t *testing.T) {
	tests := []struct {
		name    string
		frame   BifrostFrame
		wantLen int
	}{
		{
			name:    "empty payload",
			frame:   BifrostFrame{Type: FrameKeepalive, Payload: nil},
			wantLen: BifrostFrameHeaderSize,
		},
		{
			name:    "data frame",
			frame:   BifrostFrame{Type: FrameData, Payload: []byte("hello")},
			wantLen: BifrostFrameHeaderSize + 5,
		},
		{
			name:    "control frame",
			frame:   BifrostFrame{Type: FrameControl, Payload: []byte{0x01, 0x02}},
			wantLen: BifrostFrameHeaderSize + 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := tt.frame.MarshalBinary()
			if err != nil {
				t.Fatalf("MarshalBinary failed: %v", err)
			}
			if len(data) != tt.wantLen {
				t.Errorf("encoded length: got %d, want %d", len(data), tt.wantLen)
			}
			// Check magic bytes
			if data[0] != 0x56 || data[1] != 0x48 {
				t.Errorf("magic bytes: got %x %x, want 56 48", data[0], data[1])
			}
			// Check type byte
			if data[6] != byte(tt.frame.Type) {
				t.Errorf("type byte: got %x, want %x", data[6], tt.frame.Type)
			}
		})
	}
}

func TestFrameTypeString(t *testing.T) {
	tests := []struct {
		ft   FrameType
		want string
	}{
		{FrameData, "DATA"},
		{FrameControl, "CONTROL"},
		{FrameKeepalive, "KEEPALIVE"},
		{FrameClose, "CLOSE"},
		{FrameType(0xFF), "UNKNOWN(255)"},
	}
	for _, tt := range tests {
		if got := tt.ft.String(); got != tt.want {
			t.Errorf("FrameType(%d).String() = %q, want %q", tt.ft, got, tt.want)
		}
	}
}

func TestNewStackEvent(t *testing.T) {
	nid := NodeIDFromPublicKey([]byte("test-key"))
	ev := NewStackEvent("bifrost", "frame_sent", nid, map[string]int{"bytes": 42})

	if ev.Layer != "bifrost" {
		t.Errorf("Layer: got %q, want %q", ev.Layer, "bifrost")
	}
	if ev.Type != "frame_sent" {
		t.Errorf("Type: got %q, want %q", ev.Type, "frame_sent")
	}
	if ev.Timestamp == 0 {
		t.Error("Timestamp should be nonzero")
	}
	if ev.NodeID == "" {
		t.Error("NodeID should be set")
	}
}
