package types_test

import (
	"crypto/rand"
	"testing"

	"github.com/valhalla/valhalla/internal/types"
)

func BenchmarkComputeContentID(b *testing.B) {
	data := make([]byte, 4096)
	rand.Read(data)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		types.ComputeContentID(data)
	}
}

func BenchmarkXORDistance(b *testing.B) {
	var a, c types.NodeID
	rand.Read(a[:])
	rand.Read(c[:])

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		types.XORDistance(a, c)
	}
}

func BenchmarkNodeIDString(b *testing.B) {
	var id types.NodeID
	rand.Read(id[:])

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = id.String()
	}
}
