package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

type Store struct {
	client  *goredis.Client
	initErr error
}

func New(databaseURL string) *Store {
	databaseURL = strings.TrimSpace(databaseURL)
	if databaseURL == "" {
		return &Store{}
	}

	options, err := goredis.ParseURL(databaseURL)
	if err != nil {
		return &Store{initErr: fmt.Errorf("parse REDIS_DATABASE_URL: %w", err)}
	}
	return &Store{client: goredis.NewClient(options)}
}

func (s *Store) Enabled() bool {
	return s != nil && s.client != nil
}

func (s *Store) Ping(ctx context.Context) error {
	if s == nil {
		return nil
	}
	if s.initErr != nil {
		return s.initErr
	}
	if !s.Enabled() {
		return nil
	}
	return s.client.Ping(ctx).Err()
}

func (s *Store) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
	if !s.Enabled() {
		return nil
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return s.client.Set(ctx, key, payload, ttl).Err()
}

func (s *Store) GetJSON(ctx context.Context, key string, target any) (bool, error) {
	if !s.Enabled() {
		return false, nil
	}
	payload, err := s.client.Get(ctx, key).Bytes()
	if err == goredis.Nil {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, json.Unmarshal(payload, target)
}

func (s *Store) Delete(ctx context.Context, keys ...string) error {
	if !s.Enabled() || len(keys) == 0 {
		return nil
	}
	return s.client.Del(ctx, keys...).Err()
}

func (s *Store) Close() error {
	if !s.Enabled() {
		return nil
	}
	return s.client.Close()
}
