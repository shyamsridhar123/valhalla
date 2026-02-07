package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/valhalla/valhalla/internal/demo"
	"github.com/valhalla/valhalla/internal/realm"
	vrune "github.com/valhalla/valhalla/internal/rune"
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
	s.mux.HandleFunc("/api/docs", s.handleOpenAPISpec)

	// Interactive sandbox endpoints
	s.mux.HandleFunc("/api/interactive/message", s.handleSendMessage)
	s.mux.HandleFunc("/api/interactive/trust", s.handleCreateTrust)
	s.mux.HandleFunc("/api/interactive/content", s.handlePublishContent)
	s.mux.HandleFunc("/api/interactive/crdt", s.handleCRDTSet)
	s.mux.HandleFunc("/api/interactive/state/", s.handleNodeFullState)
	s.mux.HandleFunc("/api/interactive/disconnect", s.handleDisconnect)
	s.mux.HandleFunc("/api/interactive/connect", s.handleConnect)
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

// narrate broadcasts a narration event to all WebSocket clients.
func (s *Server) narrate(msg string) {
	evt := types.NewStackEvent("demo", "narration", types.NodeID{}, map[string]string{
		"scenario": "sandbox",
		"message":  msg,
	})
	s.eventHub.Broadcast(evt)
}

func (s *Server) handleSendMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Src     int    `json:"src"`
		Dst     int    `json:"dst"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	src := s.net.NodeByIndex(req.Src)
	tgt := s.net.NodeByIndex(req.Dst)
	if src == nil || tgt == nil {
		http.Error(w, "invalid node index", http.StatusBadRequest)
		return
	}

	// Register ephemeral chat handler on target if not already registered.
	if !tgt.RPCRouter.HasService("chat") {
		tgt.RPCRouter.RegisterService("chat", func(method string, args []byte, from types.NodeID) ([]byte, error) {
			if method == "message" {
				tgt.EmitEvent("realm", "chat_received", map[string]string{
					"from":    from.String()[:12],
					"message": string(args),
				})
				return []byte("delivered"), nil
			}
			return nil, fmt.Errorf("unknown method: %s", method)
		})
	}

	src.EmitEvent("veil", "encrypt", map[string]string{"target": tgt.ShortID()})

	resp, err := src.SendRPC(tgt.NodeID(), "chat", "message", []byte(req.Message))
	if err != nil {
		http.Error(w, fmt.Sprintf("send failed: %v", err), http.StatusInternalServerError)
		return
	}
	if resp.Error != "" {
		http.Error(w, fmt.Sprintf("rpc error: %s", resp.Error), http.StatusInternalServerError)
		return
	}

	s.narrate(fmt.Sprintf("Node %d (%s) -> Node %d (%s): %s", req.Src, src.ShortID(), req.Dst, tgt.ShortID(), req.Message))

	writeJSON(w, map[string]string{
		"status": "delivered",
		"from":   src.ShortID(),
		"to":     tgt.ShortID(),
	})
}

func (s *Server) handleCreateTrust(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Src        int     `json:"src"`
		Dst        int     `json:"dst"`
		Claim      string  `json:"claim"`
		Confidence float64 `json:"confidence"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	src := s.net.NodeByIndex(req.Src)
	tgt := s.net.NodeByIndex(req.Dst)
	if src == nil || tgt == nil {
		http.Error(w, "invalid node index", http.StatusBadRequest)
		return
	}

	att := vrune.CreateAttestation(src.Identity, tgt.NodeID(), req.Claim, req.Confidence, time.Hour)
	if err := src.TrustStore.Add(att); err != nil {
		http.Error(w, fmt.Sprintf("store attestation on source: %v", err), http.StatusInternalServerError)
		return
	}
	if err := tgt.TrustStore.Add(att); err != nil {
		http.Error(w, fmt.Sprintf("store attestation on target: %v", err), http.StatusInternalServerError)
		return
	}

	src.EmitEvent("rune", "attestation_created", map[string]string{
		"subject":    tgt.ShortID(),
		"claim":      req.Claim,
		"confidence": fmt.Sprintf("%.2f", req.Confidence),
	})

	s.narrate(fmt.Sprintf("Node %d (%s) attests Node %d (%s): %q (confidence: %.2f)",
		req.Src, src.ShortID(), req.Dst, tgt.ShortID(), req.Claim, req.Confidence))

	writeJSON(w, map[string]interface{}{
		"status":     "created",
		"attester":   src.ShortID(),
		"subject":    tgt.ShortID(),
		"confidence": req.Confidence,
	})
}

func (s *Server) handlePublishContent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Node  int    `json:"node"`
		Data  string `json:"data"`
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	nd := s.net.NodeByIndex(req.Node)
	if nd == nil {
		http.Error(w, "invalid node index", http.StatusBadRequest)
		return
	}

	env := nd.PublishContent([]byte(req.Data), map[string]string{"title": req.Title})

	s.narrate(fmt.Sprintf("Node %d (%s) published content %q (CID: %s)",
		req.Node, nd.ShortID(), req.Title, env.CID.String()[:16]))

	writeJSON(w, map[string]string{
		"status":    "published",
		"cid":       env.CID.String(),
		"publisher": nd.ShortID(),
	})
}

func (s *Server) handleCRDTSet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Node  int    `json:"node"`
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	nd := s.net.NodeByIndex(req.Node)
	if nd == nil {
		http.Error(w, "invalid node index", http.StatusBadRequest)
		return
	}

	nd.CRDTStore.Set(req.Key, []byte(req.Value), nd.NodeID())
	nd.EmitEvent("realm", "crdt_set", map[string]string{
		"key":   req.Key,
		"value": req.Value,
	})

	// Sync to all peers
	reg, _ := nd.CRDTStore.GetRegister(req.Key)
	syncedPeers := 0
	if reg != nil {
		for _, peer := range nd.Peers() {
			peer.CRDTStore.Merge(map[string]*realm.LWWRegister{req.Key: reg})
			syncedPeers++
		}
	}

	s.narrate(fmt.Sprintf("Node %d (%s) set CRDT %q = %q (synced to %d peers)",
		req.Node, nd.ShortID(), req.Key, req.Value, syncedPeers))

	writeJSON(w, map[string]interface{}{
		"status":       "set",
		"key":          req.Key,
		"value":        req.Value,
		"synced_peers": syncedPeers,
	})
}

func (s *Server) handleNodeFullState(w http.ResponseWriter, r *http.Request) {
	// Parse index from URL: /api/interactive/state/0
	var idx int
	path := r.URL.Path[len("/api/interactive/state/"):]
	if _, err := fmt.Sscanf(path, "%d", &idx); err != nil {
		http.Error(w, "invalid node index", http.StatusBadRequest)
		return
	}

	nd := s.net.NodeByIndex(idx)
	if nd == nil {
		http.Error(w, "node not found", http.StatusNotFound)
		return
	}

	writeJSON(w, nd.GetFullState())
}

func (s *Server) handleDisconnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		NodeA int `json:"nodeA"`
		NodeB int `json:"nodeB"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := s.net.DisconnectPair(req.NodeA, req.NodeB); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.narrate(fmt.Sprintf("Disconnected Node %d <-> Node %d", req.NodeA, req.NodeB))

	writeJSON(w, map[string]string{"status": "disconnected"})
}

func (s *Server) handleConnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		NodeA int `json:"nodeA"`
		NodeB int `json:"nodeB"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := s.net.ReconnectPair(req.NodeA, req.NodeB); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.narrate(fmt.Sprintf("Connected Node %d <-> Node %d", req.NodeA, req.NodeB))

	writeJSON(w, map[string]string{"status": "connected"})
}
