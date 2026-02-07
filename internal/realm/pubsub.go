package realm

import (
	"sync"

	"github.com/valhalla/valhalla/internal/types"
)

// Subscription represents a topic subscription.
type Subscription struct {
	Topic    string
	NodeID   types.NodeID
	Handler  func(topic string, data []byte, from types.NodeID)
}

// PubSub manages topic-based publish/subscribe messaging.
type PubSub struct {
	mu          sync.RWMutex
	subscribers map[string][]*Subscription // topic → subscribers
}

// NewPubSub creates a new PubSub instance.
func NewPubSub() *PubSub {
	return &PubSub{
		subscribers: make(map[string][]*Subscription),
	}
}

// Subscribe registers a handler for a topic.
func (ps *PubSub) Subscribe(topic string, nodeID types.NodeID, handler func(string, []byte, types.NodeID)) *Subscription {
	sub := &Subscription{
		Topic:   topic,
		NodeID:  nodeID,
		Handler: handler,
	}

	ps.mu.Lock()
	ps.subscribers[topic] = append(ps.subscribers[topic], sub)
	ps.mu.Unlock()

	return sub
}

// Unsubscribe removes a subscription.
func (ps *PubSub) Unsubscribe(sub *Subscription) {
	ps.mu.Lock()
	defer ps.mu.Unlock()

	subs := ps.subscribers[sub.Topic]
	for i, s := range subs {
		if s == sub {
			ps.subscribers[sub.Topic] = append(subs[:i], subs[i+1:]...)
			break
		}
	}
}

// Publish broadcasts data to all subscribers of a topic.
// Returns the number of subscribers notified.
func (ps *PubSub) Publish(topic string, data []byte, from types.NodeID) int {
	ps.mu.RLock()
	subs := make([]*Subscription, len(ps.subscribers[topic]))
	copy(subs, ps.subscribers[topic])
	ps.mu.RUnlock()

	for _, sub := range subs {
		sub.Handler(topic, data, from)
	}

	return len(subs)
}

// Topics returns all topics with active subscribers.
func (ps *PubSub) Topics() []string {
	ps.mu.RLock()
	defer ps.mu.RUnlock()

	topics := make([]string, 0, len(ps.subscribers))
	for topic, subs := range ps.subscribers {
		if len(subs) > 0 {
			topics = append(topics, topic)
		}
	}
	return topics
}

// SubscriberCount returns the number of subscribers for a topic.
func (ps *PubSub) SubscriberCount(topic string) int {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	return len(ps.subscribers[topic])
}
