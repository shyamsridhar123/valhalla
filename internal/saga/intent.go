package saga

import (
	"github.com/valhalla/valhalla/internal/types"
)

// IntentMessage represents a Saga-layer intent.
type IntentMessage struct {
	Type    types.IntentType  `json:"type"`
	From    types.NodeID      `json:"from"`
	Payload interface{}       `json:"payload"`
}

// WantRequest asks for content by CID.
type WantRequest struct {
	CID types.ContentID `json:"cid"`
}

// WantResponse returns a ContentEnvelope.
type WantResponse struct {
	Envelope *ContentEnvelope `json:"envelope"`
	Found    bool             `json:"found"`
}

// FindRequest looks for service providers.
type FindRequest struct {
	Service string            `json:"service"`
	Query   map[string]string `json:"query,omitempty"`
}

// FindResponse returns matching service providers.
type FindResponse struct {
	Providers []types.NodeID `json:"providers"`
}

// PublishRequest announces content availability.
type PublishRequest struct {
	Envelope *ContentEnvelope `json:"envelope"`
}

// SubscribeRequest registers interest in a topic.
type SubscribeRequest struct {
	Topic string `json:"topic"`
}
