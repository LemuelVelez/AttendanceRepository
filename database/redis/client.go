package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"attendance-repository/model"
	goredis "github.com/redis/go-redis/v9"
)

var ErrNotFound = errors.New("record not found")

const (
	repositoryIndexKey  = "attendance:repositories:uploaded"
	userEmailKeyPrefix  = "attendance:users:email:"
	userIDKeyPrefix     = "attendance:users:id:"
	repositoryKeyPrefix = "attendance:repositories:id:"
)

type Store struct {
	client  *goredis.Client
	initErr error
}

type userRecord struct {
	ID           uint      `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"passwordHash"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type repositoryRecord struct {
	Upload   model.Upload         `json:"upload"`
	Workbook model.ParsedWorkbook `json:"workbook"`
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

func (s *Store) SaveUser(ctx context.Context, user model.User) error {
	if err := s.readyError(); err != nil {
		return err
	}

	email := normalizeEmail(user.Email)
	if email == "" {
		return errors.New("user email is required")
	}
	user.Email = email

	payload, err := json.Marshal(userRecord{
		ID:           user.ID,
		Email:        user.Email,
		PasswordHash: user.PasswordHash,
		Role:         user.Role,
		CreatedAt:    user.CreatedAt,
		UpdatedAt:    user.UpdatedAt,
	})
	if err != nil {
		return fmt.Errorf("encode user: %w", err)
	}

	_, err = s.client.TxPipelined(ctx, func(pipe goredis.Pipeliner) error {
		pipe.Set(ctx, userIDKey(user.ID), payload, 0)
		pipe.Set(ctx, userEmailKey(email), strconv.FormatUint(uint64(user.ID), 10), 0)
		return nil
	})
	if err != nil {
		return fmt.Errorf("save user: %w", err)
	}
	return nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (model.User, error) {
	if err := s.readyError(); err != nil {
		return model.User{}, err
	}

	idValue, err := s.client.Get(ctx, userEmailKey(normalizeEmail(email))).Result()
	if errors.Is(err, goredis.Nil) {
		return model.User{}, ErrNotFound
	}
	if err != nil {
		return model.User{}, fmt.Errorf("find user by email: %w", err)
	}

	id, err := strconv.ParseUint(idValue, 10, 64)
	if err != nil {
		return model.User{}, fmt.Errorf("parse stored user id: %w", err)
	}
	return s.GetUserByID(ctx, uint(id))
}

func (s *Store) GetUserByID(ctx context.Context, id uint) (model.User, error) {
	if err := s.readyError(); err != nil {
		return model.User{}, err
	}

	payload, err := s.client.Get(ctx, userIDKey(id)).Bytes()
	if errors.Is(err, goredis.Nil) {
		return model.User{}, ErrNotFound
	}
	if err != nil {
		return model.User{}, fmt.Errorf("get user: %w", err)
	}

	var record userRecord
	if err := json.Unmarshal(payload, &record); err != nil {
		return model.User{}, fmt.Errorf("decode user: %w", err)
	}
	return model.User{
		ID:           record.ID,
		Email:        record.Email,
		PasswordHash: record.PasswordHash,
		Role:         record.Role,
		CreatedAt:    record.CreatedAt,
		UpdatedAt:    record.UpdatedAt,
	}, nil
}

func (s *Store) SaveRepository(ctx context.Context, upload model.Upload, workbook model.ParsedWorkbook) error {
	if err := s.readyError(); err != nil {
		return err
	}
	if strings.TrimSpace(upload.ID) == "" {
		return errors.New("repository id is required")
	}

	payload, err := json.Marshal(repositoryRecord{Upload: upload, Workbook: workbook})
	if err != nil {
		return fmt.Errorf("encode repository: %w", err)
	}

	_, err = s.client.TxPipelined(ctx, func(pipe goredis.Pipeliner) error {
		pipe.Set(ctx, repositoryKey(upload.ID), payload, 0)
		pipe.ZAdd(ctx, repositoryIndexKey, goredis.Z{
			Score:  float64(upload.UploadedAt.UnixMicro()),
			Member: upload.ID,
		})
		return nil
	})
	if err != nil {
		return fmt.Errorf("save repository: %w", err)
	}
	return nil
}

func (s *Store) ListRepositories(ctx context.Context) ([]model.Upload, error) {
	if err := s.readyError(); err != nil {
		return nil, err
	}

	ids, err := s.client.ZRevRange(ctx, repositoryIndexKey, 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("list repository ids: %w", err)
	}
	if len(ids) == 0 {
		return []model.Upload{}, nil
	}

	keys := make([]string, len(ids))
	for index, id := range ids {
		keys[index] = repositoryKey(id)
	}
	values, err := s.client.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, fmt.Errorf("load repositories: %w", err)
	}

	uploads := make([]model.Upload, 0, len(values))
	for _, value := range values {
		if value == nil {
			continue
		}
		payload, ok := value.(string)
		if !ok {
			return nil, errors.New("invalid repository payload")
		}
		var record repositoryRecord
		if err := json.Unmarshal([]byte(payload), &record); err != nil {
			return nil, fmt.Errorf("decode repository: %w", err)
		}
		uploads = append(uploads, record.Upload)
	}
	return uploads, nil
}

func (s *Store) GetRepository(ctx context.Context, id string) (model.Upload, model.ParsedWorkbook, error) {
	if err := s.readyError(); err != nil {
		return model.Upload{}, model.ParsedWorkbook{}, err
	}

	payload, err := s.client.Get(ctx, repositoryKey(strings.TrimSpace(id))).Bytes()
	if errors.Is(err, goredis.Nil) {
		return model.Upload{}, model.ParsedWorkbook{}, ErrNotFound
	}
	if err != nil {
		return model.Upload{}, model.ParsedWorkbook{}, fmt.Errorf("get repository: %w", err)
	}

	var record repositoryRecord
	if err := json.Unmarshal(payload, &record); err != nil {
		return model.Upload{}, model.ParsedWorkbook{}, fmt.Errorf("decode repository: %w", err)
	}
	return record.Upload, record.Workbook, nil
}

func (s *Store) DeleteRepository(ctx context.Context, id string) error {
	if err := s.readyError(); err != nil {
		return err
	}

	id = strings.TrimSpace(id)
	var deleteCommand *goredis.IntCmd
	_, err := s.client.TxPipelined(ctx, func(pipe goredis.Pipeliner) error {
		deleteCommand = pipe.Del(ctx, repositoryKey(id))
		pipe.ZRem(ctx, repositoryIndexKey, id)
		return nil
	})
	if err != nil {
		return fmt.Errorf("delete repository: %w", err)
	}
	if deleteCommand == nil || deleteCommand.Val() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
	if err := s.readyError(); err != nil {
		return err
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return s.client.Set(ctx, key, payload, ttl).Err()
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
		return false, err
	}
	return true, json.Unmarshal(payload, target)
}

func (s *Store) Delete(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	if err := s.readyError(); err != nil {
		return err
	}
	return s.client.Del(ctx, keys...).Err()
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

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func userEmailKey(email string) string {
	return userEmailKeyPrefix + email
}

func userIDKey(id uint) string {
	return userIDKeyPrefix + strconv.FormatUint(uint64(id), 10)
}

func repositoryKey(id string) string {
	return repositoryKeyPrefix + id
}
