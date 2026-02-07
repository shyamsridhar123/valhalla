package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/valhalla/valhalla/internal/api"
	"github.com/valhalla/valhalla/internal/demo"
)

//go:embed all:ui-dist
var uiFS embed.FS

func main() {
	var (
		port      = flag.Int("port", 9001, "base port for nodes")
		apiAddr   = flag.String("api", ":8080", "API server address")
		nodes     = flag.Int("nodes", 6, "number of nodes to run")
		demoMode  = flag.Bool("demo", false, "start in demo mode with N nodes and API server")
		bootstrap = flag.String("bootstrap", "", "bootstrap node address")
	)
	flag.Parse()

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	if *demoMode {
		runDemo(ctx, *nodes, *port, *apiAddr)
	} else {
		fmt.Println("Valhalla node starting...")
		fmt.Printf("PID: %d\n", os.Getpid())
		if *bootstrap != "" {
			fmt.Printf("Bootstrap: %s\n", *bootstrap)
		}
		fmt.Printf("Listening on port %d\n", *port)
		<-ctx.Done()
		fmt.Println("\nShutting down...")
	}
}

func runDemo(ctx context.Context, nodeCount, basePort int, apiAddr string) {
	fmt.Println("╔══════════════════════════════════════════╗")
	fmt.Println("║          VALHALLA - Demo Mode            ║")
	fmt.Println("╚══════════════════════════════════════════╝")
	fmt.Println()

	net, err := demo.NewNetwork(nodeCount, basePort)
	if err != nil {
		log.Fatalf("create network: %v", err)
	}

	fmt.Printf("Created %d-node mesh network\n", nodeCount)
	for i, nd := range net.Nodes {
		fmt.Printf("  Node %d: %s @ %s\n", i, nd.ShortID(), nd.ListenAddr)
	}
	fmt.Println()

	srv := api.NewServer(net, apiAddr)

	// Serve embedded UI files at root
	uiSub, err := fs.Sub(uiFS, "ui-dist")
	if err != nil {
		log.Printf("embedded UI not available: %v", err)
	} else {
		srv.ServeStaticUI(http.FS(uiSub))
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil {
			select {
			case <-ctx.Done():
			default:
				log.Printf("API server: %v", err)
			}
		}
	}()

	fmt.Printf("API server: http://localhost%s\n", apiAddr)
	fmt.Printf("UI:         http://localhost%s\n", apiAddr)
	fmt.Println()
	fmt.Println("Available scenarios:")
	for _, sc := range demo.AllScenarios() {
		fmt.Printf("  - %s: %s\n", sc.Name, sc.Description)
	}
	fmt.Println()
	fmt.Println("Press Ctrl+C to stop")

	<-ctx.Done()
	fmt.Println("\nShutting down...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
