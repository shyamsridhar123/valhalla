package yggdrasil

import (
	"crypto/ed25519"
	"fmt"
	"sync"
	"time"

	"github.com/valhalla/valhalla/internal/types"
)

// DHTRecord is a signed value stored in the DHT.
type DHTRecord struct {
	Key       [32]byte         `json:"key"`
	Value     []byte           `json:"value"`
	Publisher types.NodeID     `json:"publisher"`
	PubKey    ed25519.PublicKey `json:"pub_key"`
	Signature []byte           `json:"signature"`
	Sequence  uint64           `json:"sequence"`
	Timestamp int64            `json:"timestamp"`
}

// LocationRecord maps a NodeID to its current PathAddrs.
type LocationRecord struct {
	NodeID    types.NodeID     `json:"node_id"`
	Addrs     []types.PathAddr `json:"addrs"`
	Sequence  uint64           `json:"sequence"`
	Timestamp int64            `json:"timestamp"`
	Signature []byte           `json:"signature"`
}

// DHT is a simplified distributed hash table for the PoC.
// In a real implementation this would involve network RPCs;
// here it uses an in-memory store per node with a registry
// for cross-node lookups.
type DHT struct {
	self    types.NodeID
	records map[[32]byte]*DHTRecord
	mu      sync.RWMutex
}

// NewDHT creates a new DHT store for a node.
func NewDHT(self types.NodeID) *DHT {
	return &DHT{
		self:    self,
		records: make(map[[32]byte]*DHTRecord),
	}
}

// Put stores a signed record in the local DHT.
func (d *DHT) Put(record *DHTRecord) error {
	if !VerifyWithKey(record.PubKey, record.Value, record.Signature) {
		return fmt.Errorf("dht: invalid signature on record")
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	// Only update if sequence is higher (prevents replay)
	if existing, ok := d.records[record.Key]; ok {
		if record.Sequence <= existing.Sequence {
			return nil // stale record, ignore
		}
	}

	d.records[record.Key] = record
	return nil
}

// Get retrieves a record from the local DHT.
func (d *DHT) Get(key [32]byte) (*DHTRecord, bool) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	rec, ok := d.records[key]
	return rec, ok
}

// PutLocation stores a signed location record for a NodeID.
func (d *DHT) PutLocation(id *Identity, addrs []types.PathAddr, seq uint64) error {
	loc := &LocationRecord{
		NodeID:    id.NodeID,
		Addrs:     addrs,
		Sequence:  seq,
		Timestamp: time.Now().UnixMilli(),
	}

	// Sign the location data
	data := fmt.Appendf(nil, "%x:%d:%d", loc.NodeID, loc.Sequence, loc.Timestamp)
	for _, a := range addrs {
		data = fmt.Appendf(data, ":%s", a)
	}
	loc.Signature = id.Sign(data)

	record := &DHTRecord{
		Key:       loc.NodeID,
		Value:     data,
		Publisher: id.NodeID,
		PubKey:    id.PublicKey,
		Signature: loc.Signature,
		Sequence:  seq,
		Timestamp: loc.Timestamp,
	}
	return d.Put(record)
}

// GetLocation retrieves the location record for a NodeID.
func (d *DHT) GetLocation(nodeID types.NodeID) (*DHTRecord, bool) {
	return d.Get(nodeID)
}
