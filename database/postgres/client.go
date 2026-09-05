package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"attendance-repository/database"
	"attendance-repository/model"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrNotFound = database.ErrNotFound
	ErrConflict = database.ErrConflict
)

type Store struct {
	db      *gorm.DB
	initErr error
}

func New(databaseURL string) *Store {
	databaseURL = strings.TrimSpace(databaseURL)
	if databaseURL == "" {
		return &Store{initErr: errors.New("POSTGRES_DATABASE_URL is required")}
	}

	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		return &Store{initErr: fmt.Errorf("open postgres database: %w", err)}
	}

	sqlDB, err := db.DB()
	if err != nil {
		return &Store{initErr: fmt.Errorf("configure postgres database: %w", err)}
	}
	sqlDB.SetMaxOpenConns(15)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	return &Store{db: db}
}

func (s *Store) Enabled() bool {
	return s != nil && s.db != nil && s.initErr == nil
}

func (s *Store) Ping(ctx context.Context) error {
	if err := s.readyError(); err != nil {
		return err
	}
	sqlDB, err := s.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.PingContext(ctx)
}

func (s *Store) Migrate(ctx context.Context) error {
	if err := s.readyError(); err != nil {
		return err
	}

	db := s.db.WithContext(ctx)
	if err := db.AutoMigrate(
		&model.User{},
		&model.Upload{},
		&model.UploadSheet{},
		&model.UploadRow{},
		&model.RepositoryDeleteRequest{},
	); err != nil {
		return err
	}
	if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_repository_delete_requests_one_pending
		ON repository_delete_requests (upload_id)
		WHERE status = 'pending'`).Error; err != nil {
		return fmt.Errorf("create pending delete request index: %w", err)
	}

	if err := db.Exec("ALTER TABLE uploads DROP COLUMN IF EXISTS event_date").Error; err != nil {
		return fmt.Errorf("drop uploads event_date column: %w", err)
	}
	if err := db.Exec("ALTER TABLE uploads DROP COLUMN IF EXISTS event_time").Error; err != nil {
		return fmt.Errorf("drop uploads event_time column: %w", err)
	}
	return nil
}

func (s *Store) SaveUser(ctx context.Context, user model.User) error {
	if err := s.readyError(); err != nil {
		return err
	}
	user.Email = normalizeEmail(user.Email)
	if user.Email == "" {
		return errors.New("user email is required")
	}
	if err := s.db.WithContext(ctx).Save(&user).Error; err != nil {
		return fmt.Errorf("save user: %w", err)
	}
	return nil
}

func (s *Store) CreateUser(ctx context.Context, user *model.User) error {
	if err := s.readyError(); err != nil {
		return err
	}
	if user == nil {
		return errors.New("user is required")
	}
	user.Email = normalizeEmail(user.Email)
	if user.Email == "" {
		return errors.New("user email is required")
	}

	if err := s.db.WithContext(ctx).Create(user).Error; err != nil {
		if isUniqueViolation(err) {
			return ErrConflict
		}
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (s *Store) ListUsers(ctx context.Context) ([]model.User, error) {
	if err := s.readyError(); err != nil {
		return nil, err
	}

	users := make([]model.User, 0)
	if err := s.db.WithContext(ctx).Order("created_at ASC, id ASC").Find(&users).Error; err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	return users, nil
}

func (s *Store) UpdateUser(ctx context.Context, user *model.User) error {
	if err := s.readyError(); err != nil {
		return err
	}
	if user == nil || user.ID == 0 {
		return errors.New("user is required")
	}
	user.Email = normalizeEmail(user.Email)
	if user.Email == "" {
		return errors.New("user email is required")
	}

	result := s.db.WithContext(ctx).Model(&model.User{}).Where("id = ?", user.ID).Updates(map[string]any{
		"email":         user.Email,
		"password_hash": user.PasswordHash,
		"role":          model.AdminRole,
		"updated_at":    time.Now().UTC(),
	})
	if result.Error != nil {
		if isUniqueViolation(result.Error) {
			return ErrConflict
		}
		return fmt.Errorf("update user: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}

	updated, err := s.GetUserByID(ctx, user.ID)
	if err != nil {
		return err
	}
	*user = updated
	return nil
}

func (s *Store) DeleteUser(ctx context.Context, id uint) error {
	if err := s.readyError(); err != nil {
		return err
	}
	if id == 0 {
		return ErrNotFound
	}

	result := s.db.WithContext(ctx).Delete(&model.User{}, id)
	if result.Error != nil {
		return fmt.Errorf("delete user: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (model.User, error) {
	if err := s.readyError(); err != nil {
		return model.User{}, err
	}

	var user model.User
	err := s.db.WithContext(ctx).Where("email = ?", normalizeEmail(email)).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.User{}, ErrNotFound
	}
	if err != nil {
		return model.User{}, fmt.Errorf("find user by email: %w", err)
	}
	return user, nil
}

func (s *Store) GetUserByID(ctx context.Context, id uint) (model.User, error) {
	if err := s.readyError(); err != nil {
		return model.User{}, err
	}

	var user model.User
	err := s.db.WithContext(ctx).First(&user, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.User{}, ErrNotFound
	}
	if err != nil {
		return model.User{}, fmt.Errorf("get user: %w", err)
	}
	return user, nil
}

func (s *Store) SaveRepository(ctx context.Context, upload model.Upload, workbook model.ParsedWorkbook) error {
	if err := s.readyError(); err != nil {
		return err
	}
	if strings.TrimSpace(upload.ID) == "" {
		return errors.New("repository id is required")
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		metadata := upload
		metadata.Sheets = nil
		metadata.Rows = nil
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"original_name",
				"college",
				"uploaded_at",
				"updated_at",
				"size_bytes",
				"sheet_count",
				"row_count",
			}),
		}).Create(&metadata).Error; err != nil {
			return fmt.Errorf("save repository metadata: %w", err)
		}

		if err := tx.Where("upload_id = ?", upload.ID).Delete(&model.UploadRow{}).Error; err != nil {
			return fmt.Errorf("replace repository rows: %w", err)
		}
		if err := tx.Where("upload_id = ?", upload.ID).Delete(&model.UploadSheet{}).Error; err != nil {
			return fmt.Errorf("replace repository sheets: %w", err)
		}

		createdAt := upload.UpdatedAt
		if createdAt.IsZero() {
			createdAt = time.Now()
		}
		for position, sheet := range workbook.Sheets {
			headersJSON, err := json.Marshal(sheet.Headers)
			if err != nil {
				return fmt.Errorf("encode sheet headers: %w", err)
			}
			storedSheet := model.UploadSheet{
				UploadID:    upload.ID,
				Name:        sheet.Name,
				Position:    position,
				HeadersJSON: string(headersJSON),
				CreatedAt:   createdAt,
			}
			if err := tx.Create(&storedSheet).Error; err != nil {
				return fmt.Errorf("save repository sheet: %w", err)
			}

			rows := make([]model.UploadRow, 0, len(sheet.Rows))
			for rowNumber, row := range sheet.Rows {
				dataJSON, err := json.Marshal(row)
				if err != nil {
					return fmt.Errorf("encode repository row: %w", err)
				}
				rows = append(rows, model.UploadRow{
					UploadID:  upload.ID,
					SheetName: sheet.Name,
					RowNumber: rowNumber,
					DataJSON:  string(dataJSON),
					CreatedAt: createdAt,
				})
			}
			if len(rows) > 0 {
				if err := tx.CreateInBatches(rows, 500).Error; err != nil {
					return fmt.Errorf("save repository rows: %w", err)
				}
			}
		}
		return nil
	})
}

func (s *Store) ListRepositories(ctx context.Context) ([]model.Upload, error) {
	if err := s.readyError(); err != nil {
		return nil, err
	}

	uploads := make([]model.Upload, 0)
	db := s.db.WithContext(ctx)
	if err := db.Order("uploaded_at DESC").Find(&uploads).Error; err != nil {
		return nil, fmt.Errorf("list repositories: %w", err)
	}
	if err := markDeletionRequested(db, uploads); err != nil {
		return nil, err
	}
	return uploads, nil
}

func (s *Store) GetRepository(ctx context.Context, id string) (model.Upload, model.ParsedWorkbook, error) {
	if err := s.readyError(); err != nil {
		return model.Upload{}, model.ParsedWorkbook{}, err
	}

	id = strings.TrimSpace(id)
	var upload model.Upload
	err := s.db.WithContext(ctx).First(&upload, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.Upload{}, model.ParsedWorkbook{}, ErrNotFound
	}
	if err != nil {
		return model.Upload{}, model.ParsedWorkbook{}, fmt.Errorf("get repository: %w", err)
	}

	var pendingCount int64
	if err := s.db.WithContext(ctx).Model(&model.RepositoryDeleteRequest{}).
		Where("upload_id = ? AND status = ?", id, model.DeleteRequestStatusPending).
		Count(&pendingCount).Error; err != nil {
		return model.Upload{}, model.ParsedWorkbook{}, fmt.Errorf("check repository deletion request: %w", err)
	}
	upload.DeletionRequested = pendingCount > 0

	var storedSheets []model.UploadSheet
	if err := s.db.WithContext(ctx).Where("upload_id = ?", id).Order("position ASC").Find(&storedSheets).Error; err != nil {
		return model.Upload{}, model.ParsedWorkbook{}, fmt.Errorf("load repository sheets: %w", err)
	}
	var storedRows []model.UploadRow
	if err := s.db.WithContext(ctx).Where("upload_id = ?", id).Order("sheet_name ASC, row_number ASC").Find(&storedRows).Error; err != nil {
		return model.Upload{}, model.ParsedWorkbook{}, fmt.Errorf("load repository rows: %w", err)
	}

	rowsBySheet := make(map[string][]model.UploadRow, len(storedSheets))
	for _, row := range storedRows {
		rowsBySheet[row.SheetName] = append(rowsBySheet[row.SheetName], row)
	}

	workbook := model.ParsedWorkbook{Sheets: make([]model.WorkbookSheet, 0, len(storedSheets))}
	for _, storedSheet := range storedSheets {
		var headers []string
		if err := json.Unmarshal([]byte(storedSheet.HeadersJSON), &headers); err != nil {
			return model.Upload{}, model.ParsedWorkbook{}, fmt.Errorf("decode sheet headers: %w", err)
		}
		sheet := model.WorkbookSheet{
			Name:    storedSheet.Name,
			Headers: headers,
			Rows:    make([]map[string]string, 0, len(rowsBySheet[storedSheet.Name])),
		}
		for _, storedRow := range rowsBySheet[storedSheet.Name] {
			var row map[string]string
			if err := json.Unmarshal([]byte(storedRow.DataJSON), &row); err != nil {
				return model.Upload{}, model.ParsedWorkbook{}, fmt.Errorf("decode repository row: %w", err)
			}
			sheet.Rows = append(sheet.Rows, row)
		}
		workbook.RowCount += len(sheet.Rows)
		workbook.Sheets = append(workbook.Sheets, sheet)
	}
	return upload, workbook, nil
}

func (s *Store) CreateRepositoryDeleteRequest(ctx context.Context, uploadID, reason string, requestedAt time.Time) (model.RepositoryDeleteRequest, error) {
	if err := s.readyError(); err != nil {
		return model.RepositoryDeleteRequest{}, err
	}

	uploadID = strings.TrimSpace(uploadID)
	reason = strings.TrimSpace(reason)
	if uploadID == "" {
		return model.RepositoryDeleteRequest{}, ErrNotFound
	}
	if reason == "" {
		return model.RepositoryDeleteRequest{}, errors.New("deletion reason is required")
	}
	if requestedAt.IsZero() {
		requestedAt = time.Now().UTC()
	}

	var request model.RepositoryDeleteRequest
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var upload model.Upload
		if err := tx.First(&upload, "id = ?", uploadID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNotFound
			}
			return fmt.Errorf("get repository for deletion request: %w", err)
		}

		request = model.RepositoryDeleteRequest{
			UploadID:     upload.ID,
			OriginalName: upload.OriginalName,
			College:      upload.College,
			UploadedAt:   upload.UploadedAt,
			Reason:       reason,
			Status:       model.DeleteRequestStatusPending,
			RequestedAt:  requestedAt,
		}
		if err := tx.Create(&request).Error; err != nil {
			if isUniqueViolation(err) {
				return ErrConflict
			}
			return fmt.Errorf("create repository deletion request: %w", err)
		}
		return nil
	})
	if err != nil {
		return model.RepositoryDeleteRequest{}, err
	}
	return request, nil
}

func (s *Store) ListRepositoryDeleteRequests(ctx context.Context) ([]model.RepositoryDeleteRequest, error) {
	if err := s.readyError(); err != nil {
		return nil, err
	}

	requests := make([]model.RepositoryDeleteRequest, 0)
	if err := s.db.WithContext(ctx).
		Order("CASE WHEN status = 'pending' THEN 0 ELSE 1 END, requested_at DESC, id DESC").
		Find(&requests).Error; err != nil {
		return nil, fmt.Errorf("list repository deletion requests: %w", err)
	}
	return requests, nil
}

func (s *Store) GetRepositoryDeleteRequest(ctx context.Context, id uint) (model.RepositoryDeleteRequest, error) {
	if err := s.readyError(); err != nil {
		return model.RepositoryDeleteRequest{}, err
	}
	if id == 0 {
		return model.RepositoryDeleteRequest{}, ErrNotFound
	}

	var request model.RepositoryDeleteRequest
	err := s.db.WithContext(ctx).First(&request, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.RepositoryDeleteRequest{}, ErrNotFound
	}
	if err != nil {
		return model.RepositoryDeleteRequest{}, fmt.Errorf("get repository deletion request: %w", err)
	}
	return request, nil
}

func (s *Store) RejectRepositoryDeleteRequest(ctx context.Context, id, reviewerID uint, reviewedAt time.Time) (model.RepositoryDeleteRequest, error) {
	if err := s.readyError(); err != nil {
		return model.RepositoryDeleteRequest{}, err
	}
	if id == 0 {
		return model.RepositoryDeleteRequest{}, ErrNotFound
	}
	if reviewedAt.IsZero() {
		reviewedAt = time.Now().UTC()
	}

	var request model.RepositoryDeleteRequest
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&request, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNotFound
			}
			return fmt.Errorf("lock repository deletion request: %w", err)
		}
		if request.Status != model.DeleteRequestStatusPending {
			return ErrConflict
		}

		result := tx.Model(&model.RepositoryDeleteRequest{}).Where("id = ? AND status = ?", id, model.DeleteRequestStatusPending).Updates(map[string]any{
			"status":              model.DeleteRequestStatusRejected,
			"reviewed_at":         reviewedAt,
			"reviewed_by_user_id": reviewerID,
		})
		if result.Error != nil {
			return fmt.Errorf("reject repository deletion request: %w", result.Error)
		}
		if result.RowsAffected == 0 {
			return ErrConflict
		}

		request.Status = model.DeleteRequestStatusRejected
		request.ReviewedAt = &reviewedAt
		request.ReviewedByUserID = &reviewerID
		return nil
	})
	if err != nil {
		return model.RepositoryDeleteRequest{}, err
	}
	return request, nil
}

func (s *Store) CompleteRepositoryDeleteRequest(ctx context.Context, id, reviewerID uint, reviewedAt time.Time) (model.RepositoryDeleteRequest, error) {
	if err := s.readyError(); err != nil {
		return model.RepositoryDeleteRequest{}, err
	}
	if id == 0 {
		return model.RepositoryDeleteRequest{}, ErrNotFound
	}
	if reviewedAt.IsZero() {
		reviewedAt = time.Now().UTC()
	}

	var request model.RepositoryDeleteRequest
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&request, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNotFound
			}
			return fmt.Errorf("lock repository deletion request: %w", err)
		}
		if request.Status != model.DeleteRequestStatusPending {
			return ErrConflict
		}

		var upload model.Upload
		if err := tx.First(&upload, "id = ?", request.UploadID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNotFound
			}
			return fmt.Errorf("get repository for approved deletion: %w", err)
		}

		if err := tx.Where("upload_id = ?", request.UploadID).Delete(&model.UploadRow{}).Error; err != nil {
			return fmt.Errorf("delete repository rows: %w", err)
		}
		if err := tx.Where("upload_id = ?", request.UploadID).Delete(&model.UploadSheet{}).Error; err != nil {
			return fmt.Errorf("delete repository sheets: %w", err)
		}
		result := tx.Delete(&model.Upload{}, "id = ?", request.UploadID)
		if result.Error != nil {
			return fmt.Errorf("delete repository: %w", result.Error)
		}
		if result.RowsAffected == 0 {
			return ErrNotFound
		}

		result = tx.Model(&model.RepositoryDeleteRequest{}).Where("id = ? AND status = ?", id, model.DeleteRequestStatusPending).Updates(map[string]any{
			"status":              model.DeleteRequestStatusCompleted,
			"reviewed_at":         reviewedAt,
			"reviewed_by_user_id": reviewerID,
		})
		if result.Error != nil {
			return fmt.Errorf("complete repository deletion request: %w", result.Error)
		}
		if result.RowsAffected == 0 {
			return ErrConflict
		}

		request.Status = model.DeleteRequestStatusCompleted
		request.ReviewedAt = &reviewedAt
		request.ReviewedByUserID = &reviewerID
		return nil
	})
	if err != nil {
		return model.RepositoryDeleteRequest{}, err
	}
	return request, nil
}

func markDeletionRequested(db *gorm.DB, uploads []model.Upload) error {
	if len(uploads) == 0 {
		return nil
	}

	type pendingUpload struct {
		UploadID string
	}
	rows := make([]pendingUpload, 0)
	if err := db.Model(&model.RepositoryDeleteRequest{}).
		Select("upload_id").
		Where("status = ?", model.DeleteRequestStatusPending).
		Find(&rows).Error; err != nil {
		return fmt.Errorf("list pending repository deletion requests: %w", err)
	}

	pending := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		pending[row.UploadID] = struct{}{}
	}
	for i := range uploads {
		_, uploads[i].DeletionRequested = pending[uploads[i].ID]
	}
	return nil
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	sqlDB, err := s.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func (s *Store) readyError() error {
	if s == nil {
		return errors.New("postgres store is not initialized")
	}
	if s.initErr != nil {
		return s.initErr
	}
	if s.db == nil {
		return errors.New("postgres store is not initialized")
	}
	return nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "sqlstate 23505") ||
		strings.Contains(message, "duplicate key value violates unique constraint")
}
