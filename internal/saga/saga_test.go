package saga_test

import (
	"testing"
	"time"

	"github.com/valhalla/valhalla/internal/saga"
	"github.com/valhalla/valhalla/internal/types"
	"github.com/valhalla/valhalla/internal/yggdrasil"
)

func TestContentEnvelopeCreateAndVerify(t *testing.T) {
	id, _ := yggdrasil.GenerateIdentity()
	data := []byte("hello valhalla content")
	meta := map[string]string{"type": "text/plain"}

	env := saga.NewContentEnvelope(data, id, meta, time.Now().UnixMilli())

	if err := saga.VerifyEnvelope(env); err != nil {
		t.Fatalf("VerifyEnvelope: %v", err)
	}

	// CID should match
	expected := types.ComputeContentID(data)
	if env.CID != expected {
		t.Error("CID mismatch")
	}
}

func TestContentEnvelopeTampered(t *testing.T) {
	id, _ := yggdrasil.GenerateIdentity()
	env := saga.NewContentEnvelope([]byte("original"), id, nil, time.Now().UnixMilli())

	// Tamper with data
	env.Data = []byte("tampered")
	if err := saga.VerifyEnvelope(env); err == nil {
		t.Error("should reject tampered content")
	}
}

func TestContentEnvelopeWrongKey(t *testing.T) {
	id1, _ := yggdrasil.GenerateIdentity()
	id2, _ := yggdrasil.GenerateIdentity()

	env := saga.NewContentEnvelope([]byte("test"), id1, nil, time.Now().UnixMilli())

	// Replace public key with a different identity
	env.PubKey = id2.PublicKey
	env.Publisher = id2.NodeID
	if err := saga.VerifyEnvelope(env); err == nil {
		t.Error("should reject wrong key")
	}
}

func TestCachePutGet(t *testing.T) {
	cache := saga.NewCache(100)
	id, _ := yggdrasil.GenerateIdentity()

	env := saga.NewContentEnvelope([]byte("cached data"), id, nil, time.Now().UnixMilli())
	cache.Put(env)

	got, ok := cache.Get(env.CID)
	if !ok {
		t.Fatal("should find cached item")
	}
	if got.CID != env.CID {
		t.Error("cached CID mismatch")
	}
	if cache.Size() != 1 {
		t.Errorf("Size: got %d, want 1", cache.Size())
	}
}

func TestCacheEviction(t *testing.T) {
	cache := saga.NewCache(3)
	id, _ := yggdrasil.GenerateIdentity()

	envs := make([]*saga.ContentEnvelope, 5)
	for i := range envs {
		data := []byte{byte(i), byte(i + 1), byte(i + 2)}
		envs[i] = saga.NewContentEnvelope(data, id, nil, time.Now().UnixMilli())
		cache.Put(envs[i])
	}

	// Cache should have max 3 items
	if cache.Size() != 3 {
		t.Errorf("Size after eviction: got %d, want 3", cache.Size())
	}

	// Oldest entries (0, 1) should be evicted
	if _, ok := cache.Get(envs[0].CID); ok {
		t.Error("oldest entry should be evicted")
	}
	if _, ok := cache.Get(envs[1].CID); ok {
		t.Error("second oldest entry should be evicted")
	}

	// Newest entries (2, 3, 4) should exist
	for i := 2; i < 5; i++ {
		if _, ok := cache.Get(envs[i].CID); !ok {
			t.Errorf("entry %d should still be cached", i)
		}
	}
}

func TestServiceRegistry(t *testing.T) {
	reg := saga.NewServiceRegistry()

	id1, _ := yggdrasil.GenerateIdentity()
	id2, _ := yggdrasil.GenerateIdentity()

	reg.Register(saga.ServiceRecord{
		ServiceName: "chat",
		NodeID:      id1.NodeID,
		Version:     "1.0",
	})
	reg.Register(saga.ServiceRecord{
		ServiceName: "chat",
		NodeID:      id2.NodeID,
		Version:     "1.0",
	})

	providers := reg.Lookup("chat")
	if len(providers) != 2 {
		t.Fatalf("Lookup: got %d providers, want 2", len(providers))
	}

	// Lookup unknown service returns empty
	unknown := reg.Lookup("nonexistent")
	if len(unknown) != 0 {
		t.Errorf("unknown service: got %d providers, want 0", len(unknown))
	}

	// Unregister
	reg.Unregister("chat", id1.NodeID)
	after := reg.Lookup("chat")
	if len(after) != 1 {
		t.Errorf("after unregister: got %d, want 1", len(after))
	}
}

func TestPublishAndRetrieveViaCache(t *testing.T) {
	// Simulate: Node A publishes, Node B caches, Node C retrieves from B's cache
	idA, _ := yggdrasil.GenerateIdentity()

	data := []byte("content from node A")
	env := saga.NewContentEnvelope(data, idA, map[string]string{"topic": "test"}, time.Now().UnixMilli())

	// Verify content is valid
	if err := saga.VerifyEnvelope(env); err != nil {
		t.Fatalf("VerifyEnvelope: %v", err)
	}

	// Node B caches it
	cacheB := saga.NewCache(1000)
	cacheB.Put(env)

	// Node C retrieves from B's cache
	retrieved, ok := cacheB.Get(env.CID)
	if !ok {
		t.Fatal("should find in cache B")
	}

	// Node C verifies independently
	if err := saga.VerifyEnvelope(retrieved); err != nil {
		t.Fatalf("retrieved content fails verification: %v", err)
	}

	// Content integrity
	if string(retrieved.Data) != string(data) {
		t.Errorf("data mismatch: got %q, want %q", retrieved.Data, data)
	}
}
