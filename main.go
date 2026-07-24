package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"attendance-repository/config"
	"attendance-repository/controller"
	"attendance-repository/database"
	postgresstore "attendance-repository/database/postgres"
	redisstore "attendance-repository/database/redis"
	"attendance-repository/middleware"
	"attendance-repository/model"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	postgresStore := postgresstore.New(cfg.PostgresDatabaseURL)
	defer func() { _ = postgresStore.Close() }()
	redisStore := redisstore.New(cfg.RedisDatabaseURL)
	defer func() { _ = redisStore.Close() }()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	if err := postgresStore.Ping(ctx); err != nil {
		cancel()
		log.Fatalf("postgres unavailable: %v", err)
	}
	cancel()

	ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
	if err := redisStore.Ping(ctx); err != nil {
		cancel()
		log.Fatalf("redis unavailable: %v", err)
	}
	cancel()

	ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
	if err := postgresStore.Migrate(ctx); err != nil {
		cancel()
		log.Fatalf("postgres migration failed: %v", err)
	}
	cancel()

	ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
	if err := ensureAdmin(ctx, postgresStore, cfg.AdminEmail, cfg.AdminPassword, cfg.Location); err != nil {
		cancel()
		log.Fatal(err)
	}
	cancel()

	router := buildRouter(cfg, postgresStore, redisStore)
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       90 * time.Second,
	}

	go func() {
		log.Printf("attendance repository listening on http://localhost:%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("server shutdown failed: %v", err)
	}
}

func buildRouter(cfg config.Config, postgresStore *postgresstore.Store, redisStore *redisstore.Store) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())

	authMiddleware := middleware.NewAuth(cfg, postgresStore)
	authController := controller.NewAuthController(postgresStore, cfg, authMiddleware)
	userController := controller.NewUserController(postgresStore)
	repositoryController := controller.NewRepositoryController(cfg, postgresStore, redisStore)

	api := router.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		if err := postgresStore.Ping(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "error": "postgres unavailable"})
			return
		}
		if err := redisStore.Ping(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "error": "redis unavailable"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "time": time.Now().In(cfg.Location)})
	})

	authRoutes := api.Group("/auth")
	authRoutes.POST("/login", authController.Login)
	authRoutes.POST("/logout", authController.Logout)

	api.GET("/users/me", authMiddleware.Optional(), userController.Me)
	users := api.Group("/users", authMiddleware.RequireAdmin())
	users.GET("", userController.ListAdmins)
	users.GET("/:id", userController.GetAdmin)
	users.POST("", userController.CreateAdmin)
	users.PATCH("/:id", userController.UpdateAdmin)
	users.DELETE("/:id", userController.DeleteAdmin)

	repositories := api.Group("/repositories")
	repositories.GET("", repositoryController.List)
	repositories.GET("/:id", repositoryController.Get)
	repositories.GET("/:id/download", authMiddleware.RequireAdmin(), repositoryController.Download)
	repositories.POST("/preview", repositoryController.Preview)
	repositories.POST("", repositoryController.Create)
	repositories.DELETE("/:id", repositoryController.Delete)
	repositories.PATCH("/:id", authMiddleware.RequireAdmin(), repositoryController.Update)

	previewRoutes := api.Group("/repository-previews")
	previewRoutes.DELETE("/:id", repositoryController.DiscardPreview)

	serveFrontend(router)
	return router
}

func serveFrontend(router *gin.Engine) {
	dist := filepath.Clean("./view/dist")
	index := filepath.Join(dist, "index.html")
	if _, err := os.Stat(index); err != nil {
		return
	}

	assets := filepath.Join(dist, "assets")
	if _, err := os.Stat(assets); err == nil {
		router.Static("/assets", assets)
	}
	router.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
			return
		}
		c.File(index)
	})
}

func ensureAdmin(ctx context.Context, store *postgresstore.Store, email, password string, location *time.Location) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || password == "" {
		return fmt.Errorf("ADMIN_EMAIL and ADMIN_PASSWORD are required")
	}

	_, err := store.GetUserByEmail(ctx, email)
	if err == nil {
		return nil
	}
	if !errors.Is(err, database.ErrNotFound) {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	now := time.Now().In(location)
	return store.SaveUser(ctx, model.User{
		ID:           1,
		Email:        email,
		PasswordHash: string(hash),
		Role:         model.AdminRole,
		CreatedAt:    now,
		UpdatedAt:    now,
	})
}
