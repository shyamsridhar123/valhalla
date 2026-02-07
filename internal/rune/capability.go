package rune

import (
	"crypto/ed25519"
	"fmt"
	"time"

	"github.com/valhalla/valhalla/internal/types"
	"github.com/valhalla/valhalla/internal/yggdrasil"
)

// Capability is a signed, delegatable permission token.
type Capability struct {
	Issuer      types.NodeID     `json:"issuer"`
	IssuerPK    ed25519.PublicKey `json:"issuer_pk"`
	Holder      types.NodeID     `json:"holder"`
	Resource    string           `json:"resource"`
	Actions     []string         `json:"actions"`
	Delegatable bool             `json:"delegatable"`
	Expires     int64            `json:"expires"`
	CreatedAt   int64            `json:"created_at"`
	Signature   []byte           `json:"signature"`
}

// GrantCapability creates a signed capability token.
func GrantCapability(issuer *yggdrasil.Identity, holder types.NodeID, resource string, actions []string, delegatable bool, ttl time.Duration) *Capability {
	now := time.Now().UnixMilli()
	cap := &Capability{
		Issuer:      issuer.NodeID,
		IssuerPK:    issuer.PublicKey,
		Holder:      holder,
		Resource:    resource,
		Actions:     actions,
		Delegatable: delegatable,
		Expires:     now + ttl.Milliseconds(),
		CreatedAt:   now,
	}

	cap.Signature = issuer.Sign(cap.sigBytes())
	return cap
}

// Verify checks the capability's signature and expiry.
func (c *Capability) Verify() error {
	if time.Now().UnixMilli() > c.Expires {
		return fmt.Errorf("rune: capability expired")
	}

	if !yggdrasil.VerifyWithKey(c.IssuerPK, c.sigBytes(), c.Signature) {
		return fmt.Errorf("rune: invalid capability signature")
	}

	expectedID := types.NodeIDFromPublicKey(c.IssuerPK)
	if c.Issuer != expectedID {
		return fmt.Errorf("rune: issuer NodeID doesn't match public key")
	}

	return nil
}

// CheckAction verifies the capability is valid and permits the given action.
func (c *Capability) CheckAction(holder types.NodeID, action string) error {
	if err := c.Verify(); err != nil {
		return err
	}

	if c.Holder != holder {
		return fmt.Errorf("rune: holder mismatch")
	}

	for _, a := range c.Actions {
		if a == action {
			return nil
		}
	}
	return fmt.Errorf("rune: action %q not permitted", action)
}

func (c *Capability) sigBytes() []byte {
	data := fmt.Appendf(nil, "%x:%x:%s:%v:%d:%d",
		c.Issuer, c.Holder, c.Resource, c.Delegatable, c.Expires, c.CreatedAt)
	for _, a := range c.Actions {
		data = fmt.Appendf(data, ":%s", a)
	}
	return data
}
