package rune

import (
	"github.com/valhalla/valhalla/internal/types"
)

const (
	// TransitiveDecay is the decay factor for transitive trust.
	TransitiveDecay = 0.8
	// MaxTrustDepth limits the depth of transitive trust walks.
	MaxTrustDepth = 5
)

// ComputeTrust computes a trust score for a target node by walking
// the attestation graph from a set of trusted seeds.
func ComputeTrust(store *AttestationStore, self types.NodeID, target types.NodeID) float64 {
	if self == target {
		return 1.0
	}

	// BFS walk through attestation graph
	visited := make(map[types.NodeID]bool)
	type entry struct {
		nodeID types.NodeID
		trust  float64
		depth  int
	}

	queue := []entry{{nodeID: self, trust: 1.0, depth: 0}}
	visited[self] = true
	maxTrust := 0.0

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		if current.depth >= MaxTrustDepth {
			continue
		}

		// Find attestations made BY current node
		atts := store.GetBySubject(target)
		for _, att := range atts {
			if att.Attester == current.nodeID {
				// Direct attestation found
				derivedTrust := current.trust * att.Confidence * TransitiveDecay
				if derivedTrust > maxTrust {
					maxTrust = derivedTrust
				}
			}
		}

		// Also look at who the current node attests (for transitive paths)
		// Walk all subjects attested by any node we trust
		allSubjects := getAllSubjects(store)
		for _, subject := range allSubjects {
			if visited[subject] {
				continue
			}

			subjectAtts := store.GetBySubject(subject)
			for _, att := range subjectAtts {
				if att.Attester == current.nodeID {
					derivedTrust := current.trust * att.Confidence * TransitiveDecay
					if derivedTrust > 0.01 { // threshold
						visited[subject] = true
						queue = append(queue, entry{
							nodeID: subject,
							trust:  derivedTrust,
							depth:  current.depth + 1,
						})
					}
				}
			}
		}
	}

	return maxTrust
}

func getAllSubjects(store *AttestationStore) []types.NodeID {
	store.mu.RLock()
	defer store.mu.RUnlock()

	subjects := make([]types.NodeID, 0, len(store.bySubject))
	for subject := range store.bySubject {
		subjects = append(subjects, subject)
	}
	return subjects
}
