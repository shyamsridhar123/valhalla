package realm

import (
	"sync"
	"time"

	"github.com/valhalla/valhalla/internal/types"
)

// LWWRegister is a Last-Writer-Wins register for conflict-free replication.
type LWWRegister struct {
	Value     []byte       `json:"value"`
	Timestamp int64        `json:"timestamp"` // Unix milliseconds
	NodeID    types.NodeID `json:"node_id"`   // Writer's identity for tiebreaking
}

// LWWStore is a thread-safe map of LWW registers keyed by string.
type LWWStore struct {
	mu        sync.RWMutex
	registers map[string]*LWWRegister
}

// NewLWWStore creates a new LWW register store.
func NewLWWStore() *LWWStore {
	return &LWWStore{
		registers: make(map[string]*LWWRegister),
	}
}

// Set writes a value using the current timestamp.
func (s *LWWStore) Set(key string, value []byte, nodeID types.NodeID) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UnixMilli()
	existing, ok := s.registers[key]
	if !ok || now > existing.Timestamp || (now == existing.Timestamp && compareNodeIDs(nodeID, existing.NodeID)) {
		s.registers[key] = &LWWRegister{
			Value:     value,
			Timestamp: now,
			NodeID:    nodeID,
		}
	}
}

// SetWithTimestamp writes a value with an explicit timestamp (for syncing).
func (s *LWWStore) SetWithTimestamp(key string, reg *LWWRegister) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, ok := s.registers[key]
	if !ok || reg.Timestamp > existing.Timestamp ||
		(reg.Timestamp == existing.Timestamp && compareNodeIDs(reg.NodeID, existing.NodeID)) {
		s.registers[key] = reg
		return true
	}
	return false
}

// Get retrieves the current value for a key.
func (s *LWWStore) Get(key string) ([]byte, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	reg, ok := s.registers[key]
	if !ok {
		return nil, false
	}
	return reg.Value, true
}

// GetRegister retrieves the full register for a key (for syncing).
func (s *LWWStore) GetRegister(key string) (*LWWRegister, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	reg, ok := s.registers[key]
	if !ok {
		return nil, false
	}
	return reg, true
}

// Keys returns all keys in the store.
func (s *LWWStore) Keys() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	keys := make([]string, 0, len(s.registers))
	for k := range s.registers {
		keys = append(keys, k)
	}
	return keys
}

// Merge applies a remote store's registers, keeping the latest values.
// Returns the number of registers updated.
func (s *LWWStore) Merge(remote map[string]*LWWRegister) int {
	updated := 0
	for key, reg := range remote {
		if s.SetWithTimestamp(key, reg) {
			updated++
		}
	}
	return updated
}

// Snapshot returns a copy of all registers (for syncing to remote peers).
func (s *LWWStore) Snapshot() map[string]*LWWRegister {
	s.mu.RLock()
	defer s.mu.RUnlock()

	snap := make(map[string]*LWWRegister, len(s.registers))
	for k, v := range s.registers {
		snap[k] = v
	}
	return snap
}

// compareNodeIDs provides deterministic tiebreaking when timestamps are equal.
// Returns true if a should win over b (higher NodeID wins).
func compareNodeIDs(a, b types.NodeID) bool {
	for i := range a {
		if a[i] > b[i] {
			return true
		}
		if a[i] < b[i] {
			return false
		}
	}
	return false
}
