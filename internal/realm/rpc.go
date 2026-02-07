package realm

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/valhalla/valhalla/internal/types"
)

// RPCRequest represents a remote procedure call.
type RPCRequest struct {
	Service string `json:"service"`
	Method  string `json:"method"`
	Args    []byte `json:"args"`
	From    types.NodeID `json:"from"`
	ReqID   uint64 `json:"req_id"`
}

// RPCResponse represents the response to an RPC call.
type RPCResponse struct {
	ReqID uint64 `json:"req_id"`
	Data  []byte `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

// RPCHandler processes an incoming RPC request and returns a response.
type RPCHandler func(method string, args []byte, from types.NodeID) ([]byte, error)

// RPCRouter manages service registration and request dispatch.
type RPCRouter struct {
	mu       sync.RWMutex
	handlers map[string]RPCHandler
	nextReqID uint64
}

// NewRPCRouter creates a new RPC router.
func NewRPCRouter() *RPCRouter {
	return &RPCRouter{
		handlers: make(map[string]RPCHandler),
	}
}

// RegisterService registers a handler for a named service.
func (r *RPCRouter) RegisterService(name string, handler RPCHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[name] = handler
}

// UnregisterService removes a service handler.
func (r *RPCRouter) UnregisterService(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.handlers, name)
}

// HasService checks if a service is registered.
func (r *RPCRouter) HasService(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.handlers[name]
	return ok
}

// ListServices returns the names of all registered services.
func (r *RPCRouter) ListServices() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.handlers))
	for name := range r.handlers {
		names = append(names, name)
	}
	return names
}

// Dispatch handles an incoming RPC request and returns the response.
func (r *RPCRouter) Dispatch(req *RPCRequest) *RPCResponse {
	r.mu.RLock()
	handler, ok := r.handlers[req.Service]
	r.mu.RUnlock()

	if !ok {
		return &RPCResponse{
			ReqID: req.ReqID,
			Error: fmt.Sprintf("unknown service: %s", req.Service),
		}
	}

	data, err := handler(req.Method, req.Args, req.From)
	if err != nil {
		return &RPCResponse{
			ReqID: req.ReqID,
			Error: err.Error(),
		}
	}

	return &RPCResponse{
		ReqID: req.ReqID,
		Data:  data,
	}
}

// EncodeRPCRequest serializes an RPC request to JSON bytes.
func EncodeRPCRequest(req *RPCRequest) ([]byte, error) {
	return json.Marshal(req)
}

// DecodeRPCRequest deserializes an RPC request from JSON bytes.
func DecodeRPCRequest(data []byte) (*RPCRequest, error) {
	var req RPCRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, fmt.Errorf("decode rpc request: %w", err)
	}
	return &req, nil
}

// EncodeRPCResponse serializes an RPC response to JSON bytes.
func EncodeRPCResponse(resp *RPCResponse) ([]byte, error) {
	return json.Marshal(resp)
}

// DecodeRPCResponse deserializes an RPC response from JSON bytes.
func DecodeRPCResponse(data []byte) (*RPCResponse, error) {
	var resp RPCResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("decode rpc response: %w", err)
	}
	return &resp, nil
}
