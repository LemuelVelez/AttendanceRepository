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
	redisstore "attendance-repository/database/redis"
	"attendance-repository/middleware"
	"attendance-repository/model"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	db, err := database.Open(cfg.DatabasePath)
	if err != nil {
		log.Fatal(err)
	}
	if err := ensureAdmin(db, cfg.AdminEmail, cfg.AdminPassword); err != nil {
		log.Fatal(err)
	}

	cache := redisstore.New(cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)
	defer func() { _ = cache.Close() }()
	if cache.Enabled() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		if err := cache.Ping(ctx); err != nil {
			log.Printf("redis unavailable; continuing without cache: %v", err)
		}
		cancel()
	}

	router := buildRouter(db, cfg, cache)
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

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("server shutdown failed: %v", err)
	}
}

func buildRouter(db *gorm.DB, cfg config.Config, cache *redisstore.Store) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())

	authMiddleware := middleware.NewAuth(cfg, db)
	authController := controller.NewAuthController(db, cfg, authMiddleware)
	userController := controller.NewUserController()
	repositoryController := controller.NewRepositoryController(db, cfg, cache)

	api := router.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "time": time.Now().In(cfg.Location)})
	})

	authRoutes := api.Group("/auth")
	authRoutes.POST("/login", authController.Login)
	authRoutes.POST("/logout", authController.Logout)

	api.GET("/users/me", authMiddleware.Optional(), userController.Me)

	repositories := api.Group("/repositories")
	repositories.GET("", repositoryController.List)
	repositories.GET("/:id", repositoryController.Get)

	adminRepositories := repositories.Group("")
	adminRepositories.Use(authMiddleware.RequireAdmin())
	adminRepositories.POST("/preview", repositoryController.Preview)
	adminRepositories.POST("", repositoryController.Create)
	adminRepositories.PATCH("/:id", repositoryController.Update)
	adminRepositories.DELETE("/:id", repositoryController.Delete)
	adminRepositories.GET("/:id/download", repositoryController.Download)

	previewRoutes := api.Group("/repository-previews")
	previewRoutes.Use(authMiddleware.RequireAdmin())
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

func ensureAdmin(db *gorm.DB, email, password string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || password == "" {
		return fmt.Errorf("ADMIN_EMAIL and ADMIN_PASSWORD are required")
	}

	var user model.User
	err := db.Where("LOWER(email) = ?", email).First(&user).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return db.Create(&model.User{Email: email, PasswordHash: string(hash), Role: model.AdminRole}).Error
}
