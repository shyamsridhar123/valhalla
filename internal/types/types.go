// Package types defines shared types used across all Valhalla stack layers.
package types

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math/big"
	"time"
)

// NodeID is a 256-bit identifier derived from SHA-256(public_key).
type NodeID [32]byte

// base58 alphabet (Bitcoin style, no 0/O/I/l)
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// String returns the base58-encoded NodeID with a "VH" prefix.
func (n NodeID) String() string {
	// Convert to big.Int for base58 encoding
	num := new(big.Int).SetBytes(n[:])
	if num.Sign() == 0 {
		return "VH1"
	}

	var encoded []byte
	mod := new(big.Int)
	base := big.NewInt(58)

	for num.Sign() > 0 {
		num.DivMod(num, base, mod)
		encoded = append([]byte{base58Alphabet[mod.Int64()]}, encoded...)
	}

	// Preserve leading zeros
	for _, b := range n {
		if b != 0 {
			break
		}
		encoded = append([]byte{base58Alphabet[0]}, encoded...)
	}

	return "VH" + string(encoded)
}

// Short returns a truncated NodeID for display (first 8 chars after prefix).
func (n NodeID) Short() string {
	s := n.String()
	if len(s) > 10 {
		return s[:10] + "..."
	}
	return s
}

// NodeIDFromPublicKey derives a NodeID from an Ed25519 public key.
func NodeIDFromPublicKey(pubKey []byte) NodeID {
	return NodeID(sha256.Sum256(pubKey))
}

// XORDistance computes the XOR distance between two NodeIDs.
func XORDistance(a, b NodeID) NodeID {
	var result NodeID
	for i := range a {
		result[i] = a[i] ^ b[i]
	}
	return result
}

// ContentID is a multihash-encoded content identifier.
// Format: [hash_algo:1][length:1][hash:32] = 34 bytes
type ContentID [34]byte

const (
	HashAlgoSHA256 byte = 0x12
	HashLenSHA256  byte = 32
)

// ComputeContentID computes a SHA-256 ContentID from data.
func ComputeContentID(data []byte) ContentID {
	hash := sha256.Sum256(data)
	var cid ContentID
	cid[0] = HashAlgoSHA256
	cid[1] = HashLenSHA256
	copy(cid[2:], hash[:])
	return cid
}

// String returns the hex-encoded ContentID.
func (c ContentID) String() string {
	return fmt.Sprintf("%x", c[:])
}

// Short returns a truncated ContentID for display.
func (c ContentID) Short() string {
	return fmt.Sprintf("%x...", c[:6])
}

// PathAddr is a self-describing network address string.
// Examples: "/tcp/127.0.0.1:9001", "/ws/example.com:443"
type PathAddr string

// FrameType identifies the type of a Bifrost frame.
type FrameType byte

const (
	FrameData      FrameType = 0x01
	FrameControl   FrameType = 0x02
	FrameKeepalive FrameType = 0x03
	FrameClose     FrameType = 0x04
)

func (ft FrameType) String() string {
	switch ft {
	case FrameData:
		return "DATA"
	case FrameControl:
		return "CONTROL"
	case FrameKeepalive:
		return "KEEPALIVE"
	case FrameClose:
		return "CLOSE"
	default:
		return fmt.Sprintf("UNKNOWN(%d)", ft)
	}
}

// BifrostFrame is a wire-level frame for the Bifrost (bridge) layer.
//
//	┌──────┬──────┬─────┬───────────┐
//	│Magic │ Len  │Type │  Payload  │
//	│ 2B   │ 4B   │ 1B  │  Variable │
//	└──────┴──────┴─────┴───────────┘
type BifrostFrame struct {
	Type    FrameType
	Payload []byte
}

// Magic bytes identifying a Valhalla frame: "VH" (0x56 0x48).
var BifrostMagic = [2]byte{0x56, 0x48}

// BifrostFrameHeaderSize is the fixed header size: magic(2) + length(4) + type(1).
const BifrostFrameHeaderSize = 7

// MarshalBinary encodes a BifrostFrame to wire format.
func (f *BifrostFrame) MarshalBinary() ([]byte, error) {
	buf := make([]byte, BifrostFrameHeaderSize+len(f.Payload))
	buf[0] = BifrostMagic[0]
	buf[1] = BifrostMagic[1]
	binary.BigEndian.PutUint32(buf[2:6], uint32(len(f.Payload)))
	buf[6] = byte(f.Type)
	copy(buf[7:], f.Payload)
	return buf, nil
}

// StackEvent is emitted by each layer for UI instrumentation.
type StackEvent struct {
	Layer     string      `json:"layer"`
	Type      string      `json:"type"`
	Data      interface{} `json:"data,omitempty"`
	NodeID    string      `json:"node_id"`
	Timestamp int64       `json:"timestamp"`
}

// NewStackEvent creates a StackEvent with the current timestamp.
func NewStackEvent(layer, eventType string, nodeID NodeID, data interface{}) StackEvent {
	return StackEvent{
		Layer:     layer,
		Type:      eventType,
		Data:      data,
		NodeID:    nodeID.String(),
		Timestamp: time.Now().UnixMilli(),
	}
}

// IntentType identifies the type of a Saga intent message.
type IntentType byte

const (
	IntentWant      IntentType = 0x01
	IntentFind      IntentType = 0x02
	IntentPublish   IntentType = 0x03
	IntentSubscribe IntentType = 0x04
)

// StreamFlags for Veil stream frames.
type StreamFlags byte

const (
	StreamFlagFIN      StreamFlags = 0x01
	StreamFlagRST      StreamFlags = 0x02
	StreamFlagACK      StreamFlags = 0x04
	StreamFlagReliable StreamFlags = 0x08
)

// ProtocolMessageType for Yggdrasil DHT/routing messages.
type ProtocolMessageType byte

const (
	MsgPing      ProtocolMessageType = 0x01
	MsgFindNode  ProtocolMessageType = 0x02
	MsgFindValue ProtocolMessageType = 0x03
	MsgStore     ProtocolMessageType = 0x04
)
