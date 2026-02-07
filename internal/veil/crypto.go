package veil

import (
	"crypto/sha256"
	"io"

	"golang.org/x/crypto/hkdf"
)

// DeriveStreamKey derives a per-stream encryption key using HKDF.
// This is used for additional per-stream keying beyond the Noise session.
func DeriveStreamKey(sessionKey []byte, streamID uint32, keyLen int) ([]byte, error) {
	// info = "valhalla-stream-" + streamID bytes
	info := make([]byte, 0, 20)
	info = append(info, "valhalla-stream-"...)
	info = append(info, byte(streamID>>24), byte(streamID>>16), byte(streamID>>8), byte(streamID))

	r := hkdf.New(sha256.New, sessionKey, nil, info)
	key := make([]byte, keyLen)
	if _, err := io.ReadFull(r, key); err != nil {
		return nil, err
	}
	return key, nil
}
