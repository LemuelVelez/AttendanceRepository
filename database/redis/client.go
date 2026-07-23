package redis

import (
	"context"
	"encoding/json"
	"errors"
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
		return &Store{initErr: errors.New("REDIS_DATABASE_URL is required")}
	}

	options, err := goredis.ParseURL(databaseURL)
	if err != nil {
		return &Store{initErr: fmt.Errorf("parse REDIS_DATABASE_URL: %w", err)}
	}
	return &Store{client: goredis.NewClient(options)}
}

func (s *Store) Enabled() bool {
	return s != nil && s.client != nil && s.initErr == nil
}

func (s *Store) Ping(ctx context.Context) error {
	if err := s.readyError(); err != nil {
		return err
	}
	return s.client.Ping(ctx).Err()
}

func (s *Store) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
	if err := s.readyError(); err != nil {
		return err
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("encode redis value: %w", err)
	}
	if err := s.client.Set(ctx, key, payload, ttl).Err(); err != nil {
		return fmt.Errorf("set redis value: %w", err)
	}
	return nil
}

func (s *Store) GetJSON(ctx context.Context, key string, target any) (bool, error) {
	if err := s.readyError(); err != nil {
		return false, err
	}
	payload, err := s.client.Get(ctx, key).Bytes()
	if errors.Is(err, goredis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("get redis value: %w", err)
	}
	if err := json.Unmarshal(payload, target); err != nil {
		return false, fmt.Errorf("decode redis value: %w", err)
	}
	return true, nil
}

func (s *Store) Delete(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	if err := s.readyError(); err != nil {
		return err
	}
	if err := s.client.Del(ctx, keys...).Err(); err != nil {
		return fmt.Errorf("delete redis value: %w", err)
	}
	return nil
}

func (s *Store) Close() error {
	if s == nil || s.client == nil {
		return nil
	}
	return s.client.Close()
}

func (s *Store) readyError() error {
	if s == nil {
		return errors.New("redis store is not initialized")
	}
	if s.initErr != nil {
		return s.initErr
	}
	if s.client == nil {
		return errors.New("redis store is not initialized")
	}
	return nil
}
