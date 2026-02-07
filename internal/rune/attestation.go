// Package rune implements Layer 5 (Trust) of the Valhalla stack.
// It provides attestations, capability tokens, and reputation.
package rune

import (
	"crypto/ed25519"
	"fmt"
	"sync"
	"time"

	"github.com/valhalla/valhalla/internal/types"
	"github.com/valhalla/valhalla/internal/yggdrasil"
)

// Attestation is a signed claim by one node about another.
type Attestation struct {
	Subject    types.NodeID     `json:"subject"`
	Attester   types.NodeID     `json:"attester"`
	AttesterPK ed25519.PublicKey `json:"attester_pk"`
	Claim      string           `json:"claim"`
	Confidence float64          `json:"confidence"` // 0.0 to 1.0
	Expires    int64            `json:"expires"`    // Unix milliseconds
	CreatedAt  int64            `json:"created_at"`
	Signature  []byte           `json:"signature"`
}

// CreateAttestation creates a signed attestation.
func CreateAttestation(attester *yggdrasil.Identity, subject types.NodeID, claim string, confidence float64, ttl time.Duration) *Attestation {
	now := time.Now().UnixMilli()
	att := &Attestation{
		Subject:    subject,
		Attester:   attester.NodeID,
		AttesterPK: attester.PublicKey,
		Claim:      claim,
		Confidence: confidence,
		Expires:    now + ttl.Milliseconds(),
		CreatedAt:  now,
	}

	// Sign attestation fields
	sigData := att.sigBytes()
	att.Signature = attester.Sign(sigData)

	return att
}

// Verify checks the attestation's signature and expiry.
func (a *Attestation) Verify() error {
	// Check expiry
	if time.Now().UnixMilli() > a.Expires {
		return fmt.Errorf("rune: attestation expired")
	}

	// Check confidence range
	if a.Confidence < 0 || a.Confidence > 1 {
		return fmt.Errorf("rune: confidence out of range [0,1]: %f", a.Confidence)
	}

	// Verify signature
	if !yggdrasil.VerifyWithKey(a.AttesterPK, a.sigBytes(), a.Signature) {
		return fmt.Errorf("rune: invalid attestation signature")
	}

	// Verify attester NodeID matches public key
	expectedID := types.NodeIDFromPublicKey(a.AttesterPK)
	if a.Attester != expectedID {
		return fmt.Errorf("rune: attester NodeID doesn't match public key")
	}

	return nil
}

func (a *Attestation) sigBytes() []byte {
	return fmt.Appendf(nil, "%x:%x:%s:%f:%d:%d",
		a.Subject, a.Attester, a.Claim, a.Confidence, a.Expires, a.CreatedAt)
}

// AttestationStore holds attestations indexed by subject.
type AttestationStore struct {
	bySubject map[types.NodeID][]*Attestation
	mu        sync.RWMutex
}

// NewAttestationStore creates a new attestation store.
func NewAttestationStore() *AttestationStore {
	return &AttestationStore{
		bySubject: make(map[types.NodeID][]*Attestation),
	}
}

// Add stores an attestation after verification.
func (s *AttestationStore) Add(att *Attestation) error {
	if err := att.Verify(); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.bySubject[att.Subject] = append(s.bySubject[att.Subject], att)
	return nil
}

// GetBySubject returns all attestations about a subject.
func (s *AttestationStore) GetBySubject(subject types.NodeID) []*Attestation {
	s.mu.RLock()
	defer s.mu.RUnlock()

	atts := s.bySubject[subject]
	result := make([]*Attestation, 0, len(atts))
	now := time.Now().UnixMilli()
	for _, a := range atts {
		if a.Expires > now {
			result = append(result, a)
		}
	}
	return result
}
