package database

import (
	"fmt"
	"os"
	"path/filepath"

	"attendance-repository/model"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func Open(path string) (*gorm.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}

	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if err := removeLegacyFileColumns(db); err != nil {
		return nil, err
	}
	if err := db.AutoMigrate(&model.User{}, &model.Upload{}, &model.UploadSheet{}, &model.UploadRow{}); err != nil {
		return nil, fmt.Errorf("migrate database: %w", err)
	}

	return db, nil
}

func removeLegacyFileColumns(db *gorm.DB) error {
	migrator := db.Migrator()
	for _, column := range []string{"stored_name", "stored_path"} {
		if migrator.HasColumn("uploads", column) {
			if err := migrator.DropColumn("uploads", column); err != nil {
				return fmt.Errorf("remove legacy upload column %s: %w", column, err)
			}
		}
	}
	return nil
}
