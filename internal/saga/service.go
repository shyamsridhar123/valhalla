package saga

import (
	"sync"

	"github.com/valhalla/valhalla/internal/types"
)

// ServiceRecord describes a service provider in the network.
type ServiceRecord struct {
	ServiceName string            `json:"service_name"`
	NodeID      types.NodeID      `json:"node_id"`
	Capabilities map[string]string `json:"capabilities,omitempty"`
	Load        float64           `json:"load"`
	Version     string            `json:"version"`
}

// ServiceRegistry tracks available services (simplified in-memory for PoC).
type ServiceRegistry struct {
	services map[string][]ServiceRecord // service name -> providers
	mu       sync.RWMutex
}

// NewServiceRegistry creates a new service registry.
func NewServiceRegistry() *ServiceRegistry {
	return &ServiceRegistry{
		services: make(map[string][]ServiceRecord),
	}
}

// Register adds a service provider.
func (r *ServiceRegistry) Register(record ServiceRecord) {
	r.mu.Lock()
	defer r.mu.Unlock()

	providers := r.services[record.ServiceName]

	// Update if already registered
	for i, existing := range providers {
		if existing.NodeID == record.NodeID {
			providers[i] = record
			return
		}
	}

	r.services[record.ServiceName] = append(providers, record)
}

// Lookup returns providers for a service name.
func (r *ServiceRegistry) Lookup(serviceName string) []ServiceRecord {
	r.mu.RLock()
	defer r.mu.RUnlock()

	providers := r.services[serviceName]
	result := make([]ServiceRecord, len(providers))
	copy(result, providers)
	return result
}

// Unregister removes a provider from a service.
func (r *ServiceRegistry) Unregister(serviceName string, nodeID types.NodeID) {
	r.mu.Lock()
	defer r.mu.Unlock()

	providers := r.services[serviceName]
	for i, p := range providers {
		if p.NodeID == nodeID {
			r.services[serviceName] = append(providers[:i], providers[i+1:]...)
			return
		}
	}
}
