package bifrost_test

import (
	"bufio"
	"bytes"
	"testing"

	"github.com/valhalla/valhalla/internal/bifrost"
	"github.com/valhalla/valhalla/internal/types"
)

func BenchmarkFrameEncode(b *testing.B) {
	frame := &types.BifrostFrame{
		Type:    types.FrameData,
		Payload: bytes.Repeat([]byte("X"), 1024),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var buf bytes.Buffer
		w := bufio.NewWriter(&buf)
		bifrost.Encode(w, frame)
		w.Flush()
	}
}

func BenchmarkFrameDecode(b *testing.B) {
	frame := &types.BifrostFrame{
		Type:    types.FrameData,
		Payload: bytes.Repeat([]byte("X"), 1024),
	}
	var encoded bytes.Buffer
	w := bufio.NewWriter(&encoded)
	bifrost.Encode(w, frame)
	w.Flush()
	raw := encoded.Bytes()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		reader := bufio.NewReader(bytes.NewReader(raw))
		bifrost.Decode(reader)
	}
}

func BenchmarkFrameRoundtrip(b *testing.B) {
	frame := &types.BifrostFrame{
		Type:    types.FrameData,
		Payload: bytes.Repeat([]byte("X"), 4096),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var buf bytes.Buffer
		w := bufio.NewWriter(&buf)
		bifrost.Encode(w, frame)
		w.Flush()
		r := bufio.NewReader(&buf)
		bifrost.Decode(r)
	}
}
