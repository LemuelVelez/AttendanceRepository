package redis

import (
	"context"
	"encoding/json"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

type Store struct {
	client *goredis.Client
}

func New(addr, password string, db int) *Store {
	if addr == "" {
		return &Store{}
	}
	return &Store{client: goredis.NewClient(&goredis.Options{Addr: addr, Password: password, DB: db})}
}

func (s *Store) Enabled() bool {
	return s != nil && s.client != nil
}

func (s *Store) Ping(ctx context.Context) error {
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
