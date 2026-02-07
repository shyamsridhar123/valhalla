package saga

import (
	"container/list"
	"sync"

	"github.com/valhalla/valhalla/internal/types"
)

// Cache is an LRU cache of ContentEnvelopes keyed by ContentID.
type Cache struct {
	maxEntries int
	mu         sync.RWMutex
	items      map[types.ContentID]*list.Element
	order      *list.List // front = most recently used
}

type cacheEntry struct {
	cid      types.ContentID
	envelope *ContentEnvelope
}

// NewCache creates a new LRU content cache.
func NewCache(maxEntries int) *Cache {
	return &Cache{
		maxEntries: maxEntries,
		items:      make(map[types.ContentID]*list.Element),
		order:      list.New(),
	}
}

// Put adds or updates a ContentEnvelope in the cache.
func (c *Cache) Put(env *ContentEnvelope) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// If already present, move to front
	if elem, ok := c.items[env.CID]; ok {
		c.order.MoveToFront(elem)
		elem.Value.(*cacheEntry).envelope = env
		return
	}

	// Evict oldest if at capacity
	if c.order.Len() >= c.maxEntries {
		oldest := c.order.Back()
		if oldest != nil {
			c.order.Remove(oldest)
			delete(c.items, oldest.Value.(*cacheEntry).cid)
		}
	}

	// Add new entry
	entry := &cacheEntry{cid: env.CID, envelope: env}
	elem := c.order.PushFront(entry)
	c.items[env.CID] = elem
}

// Get retrieves a ContentEnvelope by CID.
func (c *Cache) Get(cid types.ContentID) (*ContentEnvelope, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	elem, ok := c.items[cid]
	if !ok {
		return nil, false
	}

	// Move to front (most recently used)
	c.order.MoveToFront(elem)
	return elem.Value.(*cacheEntry).envelope, true
}

// Size returns the number of cached items.
func (c *Cache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.order.Len()
}
