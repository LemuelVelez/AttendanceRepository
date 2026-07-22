package service

import (
	"fmt"
	"sync"
	"time"

	"attendance-repository/model"
)

type PreviewStore struct {
	mu        sync.RWMutex
	ttl       time.Duration
	manifests map[string]model.PreviewManifest
}

func NewPreviewStore(ttl time.Duration) *PreviewStore {
	return &PreviewStore{
		ttl:       ttl,
		manifests: make(map[string]model.PreviewManifest),
	}
}

func (s *PreviewStore) Save(manifest model.PreviewManifest) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.manifests[manifest.ID] = manifest
	return nil
}

func (s *PreviewStore) Load(id string) (model.PreviewManifest, error) {
	s.mu.RLock()
	manifest, found := s.manifests[id]
	s.mu.RUnlock()
	if !found {
		return model.PreviewManifest{}, fmt.Errorf("preview not found")
	}
	if time.Since(manifest.CreatedAt) > s.ttl {
		_ = s.Delete(id)
		return model.PreviewManifest{}, fmt.Errorf("preview expired")
	}
	return manifest, nil
}

func (s *PreviewStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.manifests, id)
	return nil
}

func (s *PreviewStore) CleanupExpired() error {
	cutoff := time.Now().Add(-s.ttl)
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, manifest := range s.manifests {
		if manifest.CreatedAt.Before(cutoff) {
			delete(s.manifests, id)
		}
	}
	return nil
}
