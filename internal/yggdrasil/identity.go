// Package yggdrasil implements Layer 2 (Mesh) of the Valhalla stack.
// It provides cryptographic identity, peer discovery, and overlay routing.
package yggdrasil

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"github.com/valhalla/valhalla/internal/types"
)

// Identity holds an Ed25519 keypair and the derived NodeID.
type Identity struct {
	PrivateKey ed25519.PrivateKey `json:"private_key"`
	PublicKey  ed25519.PublicKey  `json:"public_key"`
	NodeID    types.NodeID       `json:"node_id"`
	mu        sync.RWMutex
}

// GenerateIdentity creates a new random Ed25519 identity.
func GenerateIdentity() (*Identity, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("yggdrasil: generate key: %w", err)
	}
	return &Identity{
		PrivateKey: priv,
		PublicKey:  pub,
		NodeID:    types.NodeIDFromPublicKey(pub),
	}, nil
}

// Sign signs data with the identity's private key.
func (id *Identity) Sign(data []byte) []byte {
	id.mu.RLock()
	defer id.mu.RUnlock()
	return ed25519.Sign(id.PrivateKey, data)
}

// Verify checks a signature against the identity's public key.
func (id *Identity) Verify(data, sig []byte) bool {
	id.mu.RLock()
	defer id.mu.RUnlock()
	return ed25519.Verify(id.PublicKey, data, sig)
}

// VerifyWithKey checks a signature against an arbitrary public key.
func VerifyWithKey(pubKey ed25519.PublicKey, data, sig []byte) bool {
	return ed25519.Verify(pubKey, data, sig)
}

// SaveToFile persists the identity to a JSON file.
func (id *Identity) SaveToFile(path string) error {
	id.mu.RLock()
	defer id.mu.RUnlock()

	data, err := json.MarshalIndent(id, "", "  ")
	if err != nil {
		return fmt.Errorf("yggdrasil: marshal identity: %w", err)
	}
	return os.WriteFile(path, data, 0600)
}

// LoadIdentity loads an identity from a JSON file.
func LoadIdentity(path string) (*Identity, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("yggdrasil: read identity: %w", err)
	}
	var id Identity
	if err := json.Unmarshal(data, &id); err != nil {
		return nil, fmt.Errorf("yggdrasil: unmarshal identity: %w", err)
	}
	// Recompute NodeID from public key for integrity check
	expected := types.NodeIDFromPublicKey(id.PublicKey)
	if id.NodeID != expected {
		return nil, fmt.Errorf("yggdrasil: NodeID mismatch (file corrupted)")
	}
	return &id, nil
}

// PeerInfo holds information about a known peer.
type PeerInfo struct {
	NodeID    types.NodeID       `json:"node_id"`
	PublicKey ed25519.PublicKey   `json:"public_key"`
	Addrs     []types.PathAddr   `json:"addrs"`
	LastSeen  int64              `json:"last_seen"` // Unix milliseconds
}
