package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/valhalla/valhalla/internal/demo"
	"github.com/valhalla/valhalla/internal/types"
)

// Server is the HTTP API and WebSocket event server.
type Server struct {
	net      *demo.Network
	mux      *http.ServeMux
	eventHub *EventHub
	server   *http.Server
}

// NewServer creates a new API server.
func NewServer(net *demo.Network, addr string) *Server {
	s := &Server{
		net:      net,
		mux:      http.NewServeMux(),
		eventHub: NewEventHub(),
	}

	s.registerRoutes()

	s.server = &http.Server{
		Addr:    addr,
		Handler: corsMiddleware(s.mux),
	}

	// Start aggregating events from all nodes.
	go s.aggregateEvents()

	return s
}

func (s *Server) registerRoutes() {
	s.mux.HandleFunc("/api/nodes", s.handleNodes)
	s.mux.HandleFunc("/api/nodes/", s.handleNodeByIndex)
	s.mux.HandleFunc("/api/peers", s.handlePeers)
	s.mux.HandleFunc("/api/scenarios", s.handleScenarios)
	s.mux.HandleFunc("/api/scenarios/run", s.handleRunScenario)
	s.mux.HandleFunc("/api/content", s.handleContent)
	s.mux.HandleFunc("/api/trust", s.handleTrust)
	s.mux.HandleFunc("/api/events", s.handleEvents)
	s.mux.HandleFunc("/api/health", s.handleHealth)
}

// ListenAndServe starts the HTTP server.
func (s *Server) ListenAndServe() error {
	log.Printf("API server listening on %s", s.server.Addr)
	return s.server.ListenAndServe()
}

// Shutdown gracefully shuts down the server.
func (s *Server) Shutdown(ctx context.Context) error {
	s.eventHub.Close()
	return s.server.Shutdown(ctx)
}

// ServeStaticUI sets up serving an embedded filesystem at the root.
func (s *Server) ServeStaticUI(fs http.FileSystem) {
	s.mux.Handle("/", http.FileServer(fs))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]interface{}{
		"status":    "ok",
		"nodes":     s.net.Size(),
		"timestamp": time.Now().UnixMilli(),
	})
}

func (s *Server) handleNodes(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, s.net.GetAllNodeInfo())
}

func (s *Server) handleNodeByIndex(w http.ResponseWriter, r *http.Request) {
	// Parse index from URL: /api/nodes/0
	var idx int
	path := r.URL.Path[len("/api/nodes/"):]
	if _, err := fmt.Sscanf(path, "%d", &idx); err != nil {
		http.Error(w, "invalid node index", http.StatusBadRequest)
		return
	}

	nd := s.net.NodeByIndex(idx)
	if nd == nil {
		http.Error(w, "node not found", http.StatusNotFound)
		return
	}

	writeJSON(w, demo.GetNodeInfo(nd))
}

func (s *Server) handlePeers(w http.ResponseWriter, r *http.Request) {
	type PeerLink struct {
		From string `json:"from"`
		To   string `json:"to"`
	}

	var links []PeerLink
	for _, nd := range s.net.Nodes {
		for _, peer := range nd.Peers() {
			links = append(links, PeerLink{
				From: nd.ShortID(),
				To:   peer.ShortID(),
			})
		}
	}
	writeJSON(w, links)
}

func (s *Server) handleScenarios(w http.ResponseWriter, r *http.Request) {
	scenarios := demo.AllScenarios()
	type ScenarioInfo struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	infos := make([]ScenarioInfo, len(scenarios))
	for i, sc := range scenarios {
		infos[i] = ScenarioInfo{Name: sc.Name, Description: sc.Description}
	}
	writeJSON(w, infos)
}

func (s *Server) handleRunScenario(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	scenarios := demo.AllScenarios()
	var found *demo.Scenario
	for i, sc := range scenarios {
		if sc.Name == req.Name {
			found = &scenarios[i]
			break
		}
	}
	if found == nil {
		http.Error(w, "scenario not found", http.StatusNotFound)
		return
	}

	// Run scenario in background, narration goes to event hub
	go func() {
		narrate := func(msg string) {
			evt := types.NewStackEvent("demo", "narration", types.NodeID{}, map[string]string{
				"scenario": found.Name,
				"message":  msg,
			})
			s.eventHub.Broadcast(evt)
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := found.Run(ctx, s.net, narrate); err != nil {
			narrate(fmt.Sprintf("Scenario error: %v", err))
		} else {
			narrate("Scenario complete.")
		}
	}()

	writeJSON(w, map[string]string{"status": "running", "scenario": found.Name})
}

func (s *Server) handleContent(w http.ResponseWriter, r *http.Request) {
	type ContentInfo struct {
		CID       string `json:"cid"`
		Size      int    `json:"size"`
		Publisher string `json:"publisher"`
	}

	// Aggregate content from all node caches
	var contents []ContentInfo
	seen := make(map[string]bool)

	for _, nd := range s.net.Nodes {
		// Walk the cache - use the available Size() method
		// For PoC, we just report the cache size per node
		_ = nd.Cache.Size()
	}

	// Since we can't iterate the LRU cache directly,
	// return an empty list - content will show up via events
	writeJSON(w, contents)
	_ = seen
}

func (s *Server) handleTrust(w http.ResponseWriter, r *http.Request) {
	type TrustInfo struct {
		Attester   string  `json:"attester"`
		Subject    string  `json:"subject"`
		Claim      string  `json:"claim"`
		Confidence float64 `json:"confidence"`
	}

	// Aggregate attestations from all nodes
	var attestations []TrustInfo
	for _, nd := range s.net.Nodes {
		// Get attestations where this node is the subject
		atts := nd.TrustStore.GetBySubject(nd.NodeID())
		for _, att := range atts {
			attestations = append(attestations, TrustInfo{
				Attester:   att.Attester.String()[:12],
				Subject:    att.Subject.String()[:12],
				Claim:      att.Claim,
				Confidence: att.Confidence,
			})
		}
	}

	writeJSON(w, attestations)
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	s.eventHub.ServeHTTP(w, r)
}

// aggregateEvents collects events from all nodes and broadcasts to WebSocket clients.
func (s *Server) aggregateEvents() {
	for _, nd := range s.net.Nodes {
		nd := nd
		go func() {
			for evt := range nd.Events() {
				s.eventHub.Broadcast(evt)
			}
		}()
	}
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("json encode: %v", err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
