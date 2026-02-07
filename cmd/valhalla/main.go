package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	fmt.Println("Valhalla node starting...")
	fmt.Printf("PID: %d\n", os.Getpid())

	<-ctx.Done()
	fmt.Println("\nShutting down...")
}
