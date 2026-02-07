// Package saga implements Layer 4 (Intent/Content) of the Valhalla stack.
// It provides content addressing, intent-based messaging, and service discovery.
package saga

import (
	"crypto/ed25519"
	"fmt"

	"github.com/valhalla/valhalla/internal/types"
	"github.com/valhalla/valhalla/internal/yggdrasil"
)

// ContentEnvelope wraps content with its hash, publisher, and signature.
type ContentEnvelope struct {
	CID       types.ContentID  `json:"cid"`
	Data      []byte           `json:"data"`
	Publisher types.NodeID     `json:"publisher"`
	PubKey    ed25519.PublicKey `json:"pub_key"`
	Signature []byte           `json:"signature"`
	Metadata  map[string]string `json:"metadata,omitempty"`
	CreatedAt int64            `json:"created_at"`
}

// NewContentEnvelope creates a signed ContentEnvelope.
func NewContentEnvelope(data []byte, identity *yggdrasil.Identity, metadata map[string]string, createdAt int64) *ContentEnvelope {
	cid := types.ComputeContentID(data)
	// Sign CID + data
	sigData := append(cid[:], data...)
	sig := identity.Sign(sigData)

	return &ContentEnvelope{
		CID:       cid,
		Data:      data,
		Publisher: identity.NodeID,
		PubKey:    identity.PublicKey,
		Signature: sig,
		Metadata:  metadata,
		CreatedAt: createdAt,
	}
}

// VerifyEnvelope checks that the CID matches the data hash and the signature is valid.
func VerifyEnvelope(env *ContentEnvelope) error {
	// Verify CID matches data
	expected := types.ComputeContentID(env.Data)
	if env.CID != expected {
		return fmt.Errorf("saga: CID mismatch (content tampered)")
	}

	// Verify signature
	sigData := append(env.CID[:], env.Data...)
	if !yggdrasil.VerifyWithKey(env.PubKey, sigData, env.Signature) {
		return fmt.Errorf("saga: invalid signature")
	}

	// Verify publisher matches public key
	expectedID := types.NodeIDFromPublicKey(env.PubKey)
	if env.Publisher != expectedID {
		return fmt.Errorf("saga: publisher NodeID doesn't match public key")
	}

	return nil
}
