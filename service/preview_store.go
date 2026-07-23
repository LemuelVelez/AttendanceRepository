package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	redisstore "attendance-repository/database/redis"
	"attendance-repository/model"
)

const previewKeyPrefix = "attendance:previews:"

type PreviewStore struct {
	store *redisstore.Store
	ttl   time.Duration
}

func NewPreviewStore(store *redisstore.Store, ttl time.Duration) *PreviewStore {
	return &PreviewStore{store: store, ttl: ttl}
}

func (s *PreviewStore) Save(ctx context.Context, manifest model.PreviewManifest) error {
	if strings.TrimSpace(manifest.ID) == "" {
		return fmt.Errorf("preview id is required")
	}
	return s.store.SetJSON(ctx, previewKey(manifest.ID), manifest, s.ttl)
}

func (s *PreviewStore) Load(ctx context.Context, id string) (model.PreviewManifest, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return model.PreviewManifest{}, fmt.Errorf("preview not found")
	}

	var manifest model.PreviewManifest
	found, err := s.store.GetJSON(ctx, previewKey(id), &manifest)
	if err != nil {
		return model.PreviewManifest{}, err
	}
	if !found {
		return model.PreviewManifest{}, fmt.Errorf("preview not found or expired")
	}
	return manifest, nil
}

func (s *PreviewStore) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil
	}
	return s.store.Delete(ctx, previewKey(id))
}

func previewKey(id string) string {
	return previewKeyPrefix + id
}
