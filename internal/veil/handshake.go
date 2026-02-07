// Package veil implements Layer 3 (Encrypted Flow) of the Valhalla stack.
// It provides Noise-based encrypted connections with stream multiplexing.
package veil

import (
	"crypto/ed25519"
	"fmt"
	"io"
	"net"
	"sync"

	"github.com/flynn/noise"
)

// CipherSuite defines the Noise protocol configuration.
var CipherSuite = noise.NewCipherSuite(noise.DH25519, noise.CipherChaChaPoly, noise.HashSHA256)

// HandshakeResult holds the outcome of a Noise handshake.
type HandshakeResult struct {
	SendCipher *noise.CipherState
	RecvCipher *noise.CipherState
	RemoteKey  []byte // peer's static public key (Curve25519)
}

// noiseKeypair converts Ed25519 keys to Curve25519 for Noise.
// For the PoC, we generate separate Noise keypairs.
type NoiseKeypair struct {
	Private []byte
	Public  []byte
}

// GenerateNoiseKeypair generates a Curve25519 keypair for Noise.
func GenerateNoiseKeypair() (*NoiseKeypair, error) {
	kp, err := CipherSuite.GenerateKeypair(nil)
	if err != nil {
		return nil, fmt.Errorf("veil: generate noise keypair: %w", err)
	}
	return &NoiseKeypair{
		Private: kp.Private,
		Public:  kp.Public,
	}, nil
}

// PerformHandshakeInitiator performs a Noise XX handshake as initiator.
func PerformHandshakeInitiator(conn net.Conn, localKey *NoiseKeypair) (*HandshakeResult, error) {
	hs, err := noise.NewHandshakeState(noise.Config{
		CipherSuite:   CipherSuite,
		Pattern:        noise.HandshakeXX,
		Initiator:      true,
		StaticKeypair:  noise.DHKey{Private: localKey.Private, Public: localKey.Public},
	})
	if err != nil {
		return nil, fmt.Errorf("veil: init handshake: %w", err)
	}

	// XX pattern: I→R: e, R→I: e,ee,s,es, I→R: s,se
	// Message 1: Initiator sends ephemeral key
	msg1, _, _, err := hs.WriteMessage(nil, nil)
	if err != nil {
		return nil, fmt.Errorf("veil: write msg1: %w", err)
	}
	if err := writeFrame(conn, msg1); err != nil {
		return nil, err
	}

	// Message 2: Read responder's response
	msg2, err := readFrame(conn)
	if err != nil {
		return nil, err
	}
	_, _, _, err = hs.ReadMessage(nil, msg2)
	if err != nil {
		return nil, fmt.Errorf("veil: read msg2: %w", err)
	}

	// Message 3: Initiator sends static key
	msg3, sendCS, recvCS, err := hs.WriteMessage(nil, nil)
	if err != nil {
		return nil, fmt.Errorf("veil: write msg3: %w", err)
	}
	if err := writeFrame(conn, msg3); err != nil {
		return nil, err
	}

	return &HandshakeResult{
		SendCipher: sendCS,
		RecvCipher: recvCS,
		RemoteKey:  hs.PeerStatic(),
	}, nil
}

// PerformHandshakeResponder performs a Noise XX handshake as responder.
func PerformHandshakeResponder(conn net.Conn, localKey *NoiseKeypair) (*HandshakeResult, error) {
	hs, err := noise.NewHandshakeState(noise.Config{
		CipherSuite:   CipherSuite,
		Pattern:        noise.HandshakeXX,
		Initiator:      false,
		StaticKeypair:  noise.DHKey{Private: localKey.Private, Public: localKey.Public},
	})
	if err != nil {
		return nil, fmt.Errorf("veil: init handshake: %w", err)
	}

	// Message 1: Read initiator's ephemeral key
	msg1, err := readFrame(conn)
	if err != nil {
		return nil, err
	}
	_, _, _, err = hs.ReadMessage(nil, msg1)
	if err != nil {
		return nil, fmt.Errorf("veil: read msg1: %w", err)
	}

	// Message 2: Responder sends ephemeral + static keys
	msg2, _, _, err := hs.WriteMessage(nil, nil)
	if err != nil {
		return nil, fmt.Errorf("veil: write msg2: %w", err)
	}
	if err := writeFrame(conn, msg2); err != nil {
		return nil, err
	}

	// Message 3: Read initiator's static key
	msg3, err := readFrame(conn)
	if err != nil {
		return nil, err
	}
	_, recvCS, sendCS, err := hs.ReadMessage(nil, msg3)
	if err != nil {
		return nil, fmt.Errorf("veil: read msg3: %w", err)
	}

	return &HandshakeResult{
		SendCipher: sendCS,
		RecvCipher: recvCS,
		RemoteKey:  hs.PeerStatic(),
	}, nil
}

// Simple length-prefixed frame I/O for the handshake phase.
func writeFrame(conn net.Conn, data []byte) error {
	length := uint16(len(data))
	if _, err := conn.Write([]byte{byte(length >> 8), byte(length)}); err != nil {
		return fmt.Errorf("veil: write frame length: %w", err)
	}
	if _, err := conn.Write(data); err != nil {
		return fmt.Errorf("veil: write frame data: %w", err)
	}
	return nil
}

func readFrame(conn net.Conn) ([]byte, error) {
	var lenBuf [2]byte
	if _, err := io.ReadFull(conn, lenBuf[:]); err != nil {
		return nil, fmt.Errorf("veil: read frame length: %w", err)
	}
	length := int(lenBuf[0])<<8 | int(lenBuf[1])
	data := make([]byte, length)
	if _, err := io.ReadFull(conn, data); err != nil {
		return nil, fmt.Errorf("veil: read frame data: %w", err)
	}
	return data, nil
}

// Placeholder for mapping Noise keys to Ed25519 NodeIDs.
// In production, you'd derive Curve25519 from Ed25519 or use a lookup.
var _ ed25519.PublicKey

// EncryptedConn wraps a net.Conn with Noise encryption.
type EncryptedConn struct {
	raw       net.Conn
	sendCS    *noise.CipherState
	recvCS    *noise.CipherState
	remoteKey []byte
	sendMu    sync.Mutex
	recvMu    sync.Mutex
}

// NewEncryptedConn creates an encrypted connection from a handshake result.
func NewEncryptedConn(raw net.Conn, hs *HandshakeResult) *EncryptedConn {
	return &EncryptedConn{
		raw:       raw,
		sendCS:    hs.SendCipher,
		recvCS:    hs.RecvCipher,
		remoteKey: hs.RemoteKey,
	}
}

// Send encrypts and sends data.
func (c *EncryptedConn) Send(plaintext []byte) error {
	c.sendMu.Lock()
	defer c.sendMu.Unlock()

	ciphertext, err := c.sendCS.Encrypt(nil, nil, plaintext)
	if err != nil {
		return fmt.Errorf("veil: encrypt: %w", err)
	}
	return writeFrame(c.raw, ciphertext)
}

// Receive reads and decrypts data.
func (c *EncryptedConn) Receive() ([]byte, error) {
	c.recvMu.Lock()
	defer c.recvMu.Unlock()

	ciphertext, err := readFrame(c.raw)
	if err != nil {
		return nil, err
	}
	plaintext, err := c.recvCS.Decrypt(nil, nil, ciphertext)
	if err != nil {
		return nil, fmt.Errorf("veil: decrypt: %w", err)
	}
	return plaintext, nil
}

// Close closes the underlying connection.
func (c *EncryptedConn) Close() error {
	return c.raw.Close()
}

// RemoteAddr returns the remote address of the underlying connection.
func (c *EncryptedConn) RemoteAddr() string {
	return c.raw.RemoteAddr().String()
}
