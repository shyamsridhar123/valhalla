package realm_test

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/valhalla/valhalla/internal/realm"
	"github.com/valhalla/valhalla/internal/types"
	"github.com/valhalla/valhalla/internal/yggdrasil"
)

// --- RPC Tests ---

func TestRPCRouterDispatch(t *testing.T) {
	router := realm.NewRPCRouter()

	// Register an echo service
	router.RegisterService("echo", func(method string, args []byte, from types.NodeID) ([]byte, error) {
		if method == "reverse" {
			reversed := make([]byte, len(args))
			for i, b := range args {
				reversed[len(args)-1-i] = b
			}
			return reversed, nil
		}
		return args, nil
	})

	id, _ := yggdrasil.GenerateIdentity()

	// Test successful dispatch
	resp := router.Dispatch(&realm.RPCRequest{
		Service: "echo",
		Method:  "ping",
		Args:    []byte("hello"),
		From:    id.NodeID,
		ReqID:   1,
	})

	if resp.Error != "" {
		t.Fatalf("unexpected error: %s", resp.Error)
	}
	if string(resp.Data) != "hello" {
		t.Errorf("got %q, want %q", resp.Data, "hello")
	}

	// Test reverse method
	resp = router.Dispatch(&realm.RPCRequest{
		Service: "echo",
		Method:  "reverse",
		Args:    []byte("abc"),
		From:    id.NodeID,
		ReqID:   2,
	})
	if string(resp.Data) != "cba" {
		t.Errorf("reverse: got %q, want %q", resp.Data, "cba")
	}

	// Test unknown service
	resp = router.Dispatch(&realm.RPCRequest{
		Service: "nonexistent",
		Method:  "foo",
		ReqID:   3,
	})
	if resp.Error == "" {
		t.Error("should return error for unknown service")
	}
}

func TestRPCRouterServiceManagement(t *testing.T) {
	router := realm.NewRPCRouter()

	router.RegisterService("svc1", func(string, []byte, types.NodeID) ([]byte, error) { return nil, nil })
	router.RegisterService("svc2", func(string, []byte, types.NodeID) ([]byte, error) { return nil, nil })

	if !router.HasService("svc1") {
		t.Error("should have svc1")
	}
	if !router.HasService("svc2") {
		t.Error("should have svc2")
	}
	if router.HasService("svc3") {
		t.Error("should not have svc3")
	}

	services := router.ListServices()
	if len(services) != 2 {
		t.Errorf("ListServices: got %d, want 2", len(services))
	}

	router.UnregisterService("svc1")
	if router.HasService("svc1") {
		t.Error("svc1 should be removed")
	}
}

func TestRPCRequestResponseCodec(t *testing.T) {
	id, _ := yggdrasil.GenerateIdentity()

	req := &realm.RPCRequest{
		Service: "chat",
		Method:  "send",
		Args:    []byte("hello world"),
		From:    id.NodeID,
		ReqID:   42,
	}

	encoded, err := realm.EncodeRPCRequest(req)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}

	decoded, err := realm.DecodeRPCRequest(encoded)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}

	if decoded.Service != req.Service || decoded.Method != req.Method || decoded.ReqID != req.ReqID {
		t.Error("request fields mismatch after roundtrip")
	}
	if string(decoded.Args) != string(req.Args) {
		t.Error("args mismatch after roundtrip")
	}
}

func TestRPCHandlerError(t *testing.T) {
	router := realm.NewRPCRouter()
	router.RegisterService("fail", func(string, []byte, types.NodeID) ([]byte, error) {
		return nil, fmt.Errorf("intentional error")
	})

	resp := router.Dispatch(&realm.RPCRequest{
		Service: "fail",
		Method:  "boom",
		ReqID:   1,
	})

	if resp.Error == "" {
		t.Error("should propagate handler error")
	}
	if resp.Data != nil {
		t.Error("data should be nil on error")
	}
}

// --- PubSub Tests ---

func TestPubSubBasic(t *testing.T) {
	ps := realm.NewPubSub()
	id, _ := yggdrasil.GenerateIdentity()

	var received []byte
	var receivedFrom types.NodeID
	var mu sync.Mutex

	ps.Subscribe("chat/general", id.NodeID, func(topic string, data []byte, from types.NodeID) {
		mu.Lock()
		received = data
		receivedFrom = from
		mu.Unlock()
	})

	sender, _ := yggdrasil.GenerateIdentity()
	n := ps.Publish("chat/general", []byte("hello room"), sender.NodeID)

	if n != 1 {
		t.Errorf("publish notified %d, want 1", n)
	}

	mu.Lock()
	if string(received) != "hello room" {
		t.Errorf("received: got %q, want %q", received, "hello room")
	}
	if receivedFrom != sender.NodeID {
		t.Error("sender mismatch")
	}
	mu.Unlock()
}

func TestPubSubMultipleSubscribers(t *testing.T) {
	ps := realm.NewPubSub()
	var count atomic.Int32

	for i := 0; i < 5; i++ {
		id, _ := yggdrasil.GenerateIdentity()
		ps.Subscribe("events", id.NodeID, func(string, []byte, types.NodeID) {
			count.Add(1)
		})
	}

	sender, _ := yggdrasil.GenerateIdentity()
	n := ps.Publish("events", []byte("event1"), sender.NodeID)
	if n != 5 {
		t.Errorf("notified %d, want 5", n)
	}
	if count.Load() != 5 {
		t.Errorf("handler called %d times, want 5", count.Load())
	}
}

func TestPubSubUnsubscribe(t *testing.T) {
	ps := realm.NewPubSub()
	id, _ := yggdrasil.GenerateIdentity()
	var count atomic.Int32

	sub := ps.Subscribe("topic", id.NodeID, func(string, []byte, types.NodeID) {
		count.Add(1)
	})

	sender, _ := yggdrasil.GenerateIdentity()
	ps.Publish("topic", []byte("msg1"), sender.NodeID)
	if count.Load() != 1 {
		t.Fatal("should receive first message")
	}

	ps.Unsubscribe(sub)
	ps.Publish("topic", []byte("msg2"), sender.NodeID)
	if count.Load() != 1 {
		t.Error("should not receive after unsubscribe")
	}
}

func TestPubSubTopics(t *testing.T) {
	ps := realm.NewPubSub()
	id, _ := yggdrasil.GenerateIdentity()
	noop := func(string, []byte, types.NodeID) {}

	ps.Subscribe("alpha", id.NodeID, noop)
	ps.Subscribe("beta", id.NodeID, noop)

	topics := ps.Topics()
	if len(topics) != 2 {
		t.Errorf("Topics: got %d, want 2", len(topics))
	}

	if ps.SubscriberCount("alpha") != 1 {
		t.Error("alpha should have 1 subscriber")
	}
	if ps.SubscriberCount("gamma") != 0 {
		t.Error("gamma should have 0 subscribers")
	}
}

func TestPubSubNoSubscribers(t *testing.T) {
	ps := realm.NewPubSub()
	sender, _ := yggdrasil.GenerateIdentity()
	n := ps.Publish("empty-topic", []byte("hello"), sender.NodeID)
	if n != 0 {
		t.Errorf("should notify 0 subscribers, got %d", n)
	}
}

// --- CRDT Tests ---

func TestLWWStoreSetGet(t *testing.T) {
	store := realm.NewLWWStore()
	id, _ := yggdrasil.GenerateIdentity()

	store.Set("name", []byte("alice"), id.NodeID)

	val, ok := store.Get("name")
	if !ok {
		t.Fatal("should find key")
	}
	if string(val) != "alice" {
		t.Errorf("got %q, want %q", val, "alice")
	}

	// Missing key
	_, ok = store.Get("nonexistent")
	if ok {
		t.Error("should not find nonexistent key")
	}
}

func TestLWWStoreLastWriterWins(t *testing.T) {
	store := realm.NewLWWStore()
	id1, _ := yggdrasil.GenerateIdentity()
	id2, _ := yggdrasil.GenerateIdentity()

	// Two writers write to the same key with explicit timestamps
	store.SetWithTimestamp("color", &realm.LWWRegister{
		Value:     []byte("red"),
		Timestamp: 1000,
		NodeID:    id1.NodeID,
	})

	store.SetWithTimestamp("color", &realm.LWWRegister{
		Value:     []byte("blue"),
		Timestamp: 2000,
		NodeID:    id2.NodeID,
	})

	val, _ := store.Get("color")
	if string(val) != "blue" {
		t.Errorf("should keep later write: got %q, want %q", val, "blue")
	}

	// Earlier timestamp should not overwrite
	store.SetWithTimestamp("color", &realm.LWWRegister{
		Value:     []byte("green"),
		Timestamp: 500,
		NodeID:    id1.NodeID,
	})

	val, _ = store.Get("color")
	if string(val) != "blue" {
		t.Errorf("earlier write should not overwrite: got %q, want %q", val, "blue")
	}
}

func TestLWWStoreMerge(t *testing.T) {
	storeA := realm.NewLWWStore()
	storeB := realm.NewLWWStore()
	idA, _ := yggdrasil.GenerateIdentity()
	idB, _ := yggdrasil.GenerateIdentity()

	// Store A has key1 at t=1000
	storeA.SetWithTimestamp("key1", &realm.LWWRegister{
		Value: []byte("a-val"), Timestamp: 1000, NodeID: idA.NodeID,
	})

	// Store B has key1 at t=2000, key2 at t=500
	storeB.SetWithTimestamp("key1", &realm.LWWRegister{
		Value: []byte("b-val"), Timestamp: 2000, NodeID: idB.NodeID,
	})
	storeB.SetWithTimestamp("key2", &realm.LWWRegister{
		Value: []byte("only-b"), Timestamp: 500, NodeID: idB.NodeID,
	})

	// Merge B into A
	updated := storeA.Merge(storeB.Snapshot())
	if updated != 2 {
		t.Errorf("merge updated %d, want 2", updated)
	}

	// key1 should have B's value (later timestamp)
	val, _ := storeA.Get("key1")
	if string(val) != "b-val" {
		t.Errorf("key1: got %q, want %q", val, "b-val")
	}

	// key2 should exist
	val, _ = storeA.Get("key2")
	if string(val) != "only-b" {
		t.Errorf("key2: got %q, want %q", val, "only-b")
	}
}

func TestLWWStoreKeys(t *testing.T) {
	store := realm.NewLWWStore()
	id, _ := yggdrasil.GenerateIdentity()

	store.Set("a", []byte("1"), id.NodeID)
	store.Set("b", []byte("2"), id.NodeID)
	store.Set("c", []byte("3"), id.NodeID)

	keys := store.Keys()
	if len(keys) != 3 {
		t.Errorf("Keys: got %d, want 3", len(keys))
	}
}

func TestLWWStoreSnapshot(t *testing.T) {
	store := realm.NewLWWStore()
	id, _ := yggdrasil.GenerateIdentity()

	store.Set("x", []byte("hello"), id.NodeID)
	snap := store.Snapshot()

	if len(snap) != 1 {
		t.Fatalf("snapshot size: got %d, want 1", len(snap))
	}
	if string(snap["x"].Value) != "hello" {
		t.Errorf("snapshot value: got %q, want %q", snap["x"].Value, "hello")
	}
}

// --- Integration Test: Full Chat Scenario ---

func TestChatScenario(t *testing.T) {
	// Simulate a chat application using RPC + PubSub + CRDT

	// Setup identities
	alice, _ := yggdrasil.GenerateIdentity()
	bob, _ := yggdrasil.GenerateIdentity()

	// Setup RPC routers (one per node)
	aliceRPC := realm.NewRPCRouter()
	bobRPC := realm.NewRPCRouter()

	// Setup shared state (CRDT)
	aliceState := realm.NewLWWStore()
	bobState := realm.NewLWWStore()

	// Setup PubSub
	chatPubSub := realm.NewPubSub()

	// Collect messages
	var aliceMessages []string
	var bobMessages []string
	var mu sync.Mutex

	// Register chat service on both nodes
	chatHandler := func(method string, args []byte, from types.NodeID) ([]byte, error) {
		switch method {
		case "send":
			return []byte("delivered"), nil
		case "status":
			return []byte("online"), nil
		default:
			return nil, fmt.Errorf("unknown method: %s", method)
		}
	}
	aliceRPC.RegisterService("chat", chatHandler)
	bobRPC.RegisterService("chat", chatHandler)

	// Subscribe to chat room
	chatPubSub.Subscribe("room/general", alice.NodeID, func(topic string, data []byte, from types.NodeID) {
		mu.Lock()
		aliceMessages = append(aliceMessages, string(data))
		mu.Unlock()
	})
	chatPubSub.Subscribe("room/general", bob.NodeID, func(topic string, data []byte, from types.NodeID) {
		mu.Lock()
		bobMessages = append(bobMessages, string(data))
		mu.Unlock()
	})

	// Step 1: Alice discovers chat service via RPC
	resp := aliceRPC.Dispatch(&realm.RPCRequest{
		Service: "chat", Method: "status", From: alice.NodeID, ReqID: 1,
	})
	if resp.Error != "" || string(resp.Data) != "online" {
		t.Fatalf("chat status: error=%s, data=%s", resp.Error, resp.Data)
	}

	// Step 2: Alice sends message via PubSub
	chatPubSub.Publish("room/general", []byte("Hello from Alice!"), alice.NodeID)
	time.Sleep(10 * time.Millisecond)

	// Step 3: Bob sends message
	chatPubSub.Publish("room/general", []byte("Hi Alice! -Bob"), bob.NodeID)
	time.Sleep(10 * time.Millisecond)

	// Step 4: Both update shared state (room topic)
	aliceState.Set("room/general/topic", []byte("Welcome to Valhalla"), alice.NodeID)
	time.Sleep(2 * time.Millisecond)
	bobState.Set("room/general/topic", []byte("Valhalla Chat"), bob.NodeID)

	// Step 5: Sync states (simulate CRDT merge)
	aliceState.Merge(bobState.Snapshot())
	bobState.Merge(aliceState.Snapshot())

	// Verify: Both nodes should have received both messages
	mu.Lock()
	if len(aliceMessages) != 2 {
		t.Errorf("alice received %d messages, want 2", len(aliceMessages))
	}
	if len(bobMessages) != 2 {
		t.Errorf("bob received %d messages, want 2", len(bobMessages))
	}
	mu.Unlock()

	// Verify: Both have same topic after merge (Bob's is later)
	aliceTopic, _ := aliceState.Get("room/general/topic")
	bobTopic, _ := bobState.Get("room/general/topic")
	if string(aliceTopic) != string(bobTopic) {
		t.Errorf("CRDT convergence failed: alice=%q, bob=%q", aliceTopic, bobTopic)
	}

	// Verify: RPC codec works
	req := &realm.RPCRequest{Service: "chat", Method: "send", Args: []byte("test"), From: alice.NodeID, ReqID: 99}
	encoded, _ := realm.EncodeRPCRequest(req)
	decoded, _ := realm.DecodeRPCRequest(encoded)
	if decoded.Service != "chat" || decoded.ReqID != 99 {
		t.Error("RPC codec roundtrip failed")
	}

	t.Logf("Chat scenario: %d messages exchanged, CRDT states converged", len(aliceMessages)+len(bobMessages))
	_ = bobRPC // bob's router is ready but not called directly in this test path
}
