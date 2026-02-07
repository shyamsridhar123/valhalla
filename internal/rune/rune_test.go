package rune_test

import (
	"testing"
	"time"

	vrune "github.com/valhalla/valhalla/internal/rune"
	"github.com/valhalla/valhalla/internal/yggdrasil"
)

func TestAttestationCreateAndVerify(t *testing.T) {
	alice, _ := yggdrasil.GenerateIdentity()
	bob, _ := yggdrasil.GenerateIdentity()

	att := vrune.CreateAttestation(alice, bob.NodeID, "is-trusted", 0.9, time.Hour)

	if err := att.Verify(); err != nil {
		t.Fatalf("Verify: %v", err)
	}

	if att.Subject != bob.NodeID {
		t.Error("wrong subject")
	}
	if att.Attester != alice.NodeID {
		t.Error("wrong attester")
	}
}

func TestAttestationTampered(t *testing.T) {
	alice, _ := yggdrasil.GenerateIdentity()
	bob, _ := yggdrasil.GenerateIdentity()

	att := vrune.CreateAttestation(alice, bob.NodeID, "is-trusted", 0.9, time.Hour)
	att.Confidence = 0.1 // tamper

	if err := att.Verify(); err == nil {
		t.Error("should reject tampered attestation")
	}
}

func TestAttestationExpired(t *testing.T) {
	alice, _ := yggdrasil.GenerateIdentity()
	bob, _ := yggdrasil.GenerateIdentity()

	att := vrune.CreateAttestation(alice, bob.NodeID, "is-trusted", 0.9, -time.Hour) // already expired

	if err := att.Verify(); err == nil {
		t.Error("should reject expired attestation")
	}
}

func TestCapabilityGrantAndVerify(t *testing.T) {
	alice, _ := yggdrasil.GenerateIdentity()
	bob, _ := yggdrasil.GenerateIdentity()

	cap := vrune.GrantCapability(alice, bob.NodeID, "/photos/*", []string{"read"}, false, time.Hour)

	if err := cap.Verify(); err != nil {
		t.Fatalf("Verify: %v", err)
	}

	if err := cap.CheckAction(bob.NodeID, "read"); err != nil {
		t.Fatalf("CheckAction read: %v", err)
	}

	if err := cap.CheckAction(bob.NodeID, "write"); err == nil {
		t.Error("should reject unpermitted action")
	}
}

func TestCapabilityWrongHolder(t *testing.T) {
	alice, _ := yggdrasil.GenerateIdentity()
	bob, _ := yggdrasil.GenerateIdentity()
	carol, _ := yggdrasil.GenerateIdentity()

	cap := vrune.GrantCapability(alice, bob.NodeID, "/photos/*", []string{"read"}, false, time.Hour)

	if err := cap.CheckAction(carol.NodeID, "read"); err == nil {
		t.Error("should reject wrong holder")
	}
}

func TestTransitiveTrust(t *testing.T) {
	alice, _ := yggdrasil.GenerateIdentity()
	bob, _ := yggdrasil.GenerateIdentity()
	carol, _ := yggdrasil.GenerateIdentity()

	store := vrune.NewAttestationStore()

	// Alice attests Bob (0.9 confidence)
	att1 := vrune.CreateAttestation(alice, bob.NodeID, "is-trusted", 0.9, time.Hour)
	if err := store.Add(att1); err != nil {
		t.Fatalf("Add att1: %v", err)
	}

	// Bob attests Carol (0.8 confidence)
	att2 := vrune.CreateAttestation(bob, carol.NodeID, "is-trusted", 0.8, time.Hour)
	if err := store.Add(att2); err != nil {
		t.Fatalf("Add att2: %v", err)
	}

	// Alice's direct trust in Bob
	trustBob := vrune.ComputeTrust(store, alice.NodeID, bob.NodeID)
	if trustBob < 0.5 {
		t.Errorf("trust in Bob: got %f, want > 0.5", trustBob)
	}

	// Alice's transitive trust in Carol (via Bob)
	trustCarol := vrune.ComputeTrust(store, alice.NodeID, carol.NodeID)
	if trustCarol <= 0 {
		t.Errorf("transitive trust in Carol: got %f, want > 0", trustCarol)
	}

	// Transitive trust should be less than direct trust
	if trustCarol >= trustBob {
		t.Errorf("transitive trust (%f) should be less than direct trust (%f)", trustCarol, trustBob)
	}

	// Self-trust should be 1.0
	selfTrust := vrune.ComputeTrust(store, alice.NodeID, alice.NodeID)
	if selfTrust != 1.0 {
		t.Errorf("self trust: got %f, want 1.0", selfTrust)
	}

	// Unknown node should have 0 trust
	unknown, _ := yggdrasil.GenerateIdentity()
	noTrust := vrune.ComputeTrust(store, alice.NodeID, unknown.NodeID)
	if noTrust != 0 {
		t.Errorf("unknown trust: got %f, want 0", noTrust)
	}
}

func TestAttestationStore(t *testing.T) {
	store := vrune.NewAttestationStore()
	alice, _ := yggdrasil.GenerateIdentity()
	bob, _ := yggdrasil.GenerateIdentity()

	att := vrune.CreateAttestation(alice, bob.NodeID, "is-human", 0.95, time.Hour)
	if err := store.Add(att); err != nil {
		t.Fatalf("Add: %v", err)
	}

	atts := store.GetBySubject(bob.NodeID)
	if len(atts) != 1 {
		t.Fatalf("GetBySubject: got %d, want 1", len(atts))
	}
	if atts[0].Claim != "is-human" {
		t.Errorf("claim: got %q, want %q", atts[0].Claim, "is-human")
	}
}
