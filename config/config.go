package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port                string
	JWTSecret           string
	AuthCookieName      string
	AdminEmail          string
	AdminPassword       string
	PostgresDatabaseURL string
	RedisDatabaseURL    string
	FrontendOrigin      string
	MaxUploadBytes      int64
	SessionDuration     time.Duration
	PreviewTTL          time.Duration
	Location            *time.Location
}

func Load() Config {
	locationName := env("APP_TIMEZONE", "Asia/Manila")
	location, err := time.LoadLocation(locationName)
	if err != nil {
		location = time.UTC
	}

	return Config{
		Port:                env("PORT", "8080"),
		JWTSecret:           env("JWT_SECRET", "replace-this-secret"),
		AuthCookieName:      env("AUTH_COOKIE_NAME", "attendance_token"),
		AdminEmail:          env("ADMIN_EMAIL", "admin@example.com"),
		AdminPassword:       env("ADMIN_PASSWORD", "Admin123!"),
		PostgresDatabaseURL: strings.TrimSpace(os.Getenv("POSTGRES_DATABASE_URL")),
		RedisDatabaseURL:    strings.TrimSpace(os.Getenv("REDIS_DATABASE_URL")),
		FrontendOrigin:      env("FRONTEND_ORIGIN", "http://localhost:5173"),
		MaxUploadBytes:      envInt64("MAX_UPLOAD_BYTES", 15*1024*1024),
		SessionDuration:     envDuration("SESSION_DURATION", 12*time.Hour),
		PreviewTTL:          envDuration("PREVIEW_TTL", 30*time.Minute),
		Location:            location,
	}
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envInt64(key string, fallback int64) int64 {
	value, err := strconv.ParseInt(strings.TrimSpace(os.Getenv(key)), 10, 64)
	if err != nil {
		return fallback
	}
	return value
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value, err := time.ParseDuration(strings.TrimSpace(os.Getenv(key)))
	if err != nil {
		return fallback
	}
	return value
}
