package yggdrasil

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGenerateIdentity(t *testing.T) {
	id, err := GenerateIdentity()
	if err != nil {
		t.Fatalf("GenerateIdentity: %v", err)
	}

	if len(id.PrivateKey) != 64 {
		t.Errorf("private key length: got %d, want 64", len(id.PrivateKey))
	}
	if len(id.PublicKey) != 32 {
		t.Errorf("public key length: got %d, want 32", len(id.PublicKey))
	}

	var zero [32]byte
	if id.NodeID == zero {
		t.Error("NodeID should not be zero")
	}
}

func TestIdentityUniqueness(t *testing.T) {
	id1, _ := GenerateIdentity()
	id2, _ := GenerateIdentity()

	if id1.NodeID == id2.NodeID {
		t.Error("two generated identities should have different NodeIDs")
	}
}

func TestSignAndVerify(t *testing.T) {
	id, _ := GenerateIdentity()
	msg := []byte("hello valhalla")

	sig := id.Sign(msg)
	if len(sig) != 64 {
		t.Fatalf("signature length: got %d, want 64", len(sig))
	}

	if !id.Verify(msg, sig) {
		t.Error("signature should verify with correct key")
	}

	if id.Verify([]byte("wrong message"), sig) {
		t.Error("signature should not verify with wrong message")
	}

	// Tamper with signature
	tampered := make([]byte, len(sig))
	copy(tampered, sig)
	tampered[0] ^= 0xFF
	if id.Verify(msg, tampered) {
		t.Error("tampered signature should not verify")
	}
}

func TestVerifyWithKey(t *testing.T) {
	id, _ := GenerateIdentity()
	msg := []byte("test data")
	sig := id.Sign(msg)

	if !VerifyWithKey(id.PublicKey, msg, sig) {
		t.Error("VerifyWithKey should succeed with correct key")
	}

	other, _ := GenerateIdentity()
	if VerifyWithKey(other.PublicKey, msg, sig) {
		t.Error("VerifyWithKey should fail with wrong key")
	}
}

func TestIdentitySaveLoad(t *testing.T) {
	id, _ := GenerateIdentity()

	dir := t.TempDir()
	path := filepath.Join(dir, "identity.json")

	if err := id.SaveToFile(path); err != nil {
		t.Fatalf("SaveToFile: %v", err)
	}

	// Check file permissions
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0600 {
		t.Errorf("file permissions: got %o, want 0600", perm)
	}

	loaded, err := LoadIdentity(path)
	if err != nil {
		t.Fatalf("LoadIdentity: %v", err)
	}

	if loaded.NodeID != id.NodeID {
		t.Error("loaded NodeID doesn't match original")
	}

	// Verify signature still works after load
	msg := []byte("persistence test")
	sig := id.Sign(msg)
	if !loaded.Verify(msg, sig) {
		t.Error("loaded identity should verify original signature")
	}
}
