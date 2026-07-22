package controller

import (
	"net/http"
	"strings"

	"attendance-repository/config"
	"attendance-repository/middleware"
	"attendance-repository/model"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthController struct {
	db   *gorm.DB
	cfg  config.Config
	auth *middleware.Auth
}

func NewAuthController(db *gorm.DB, cfg config.Config, auth *middleware.Auth) *AuthController {
	return &AuthController{db: db, cfg: cfg, auth: auth}
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (a *AuthController) Login(c *gin.Context) {
	var request loginRequest
	if !bindJSON(c, &request) {
		return
	}

	var user model.User
	if err := a.db.Where("LOWER(email) = ?", strings.ToLower(strings.TrimSpace(request.Email))).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(request.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	token, err := a.auth.Sign(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create session failed"})
		return
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(a.cfg.AuthCookieName, token, int(a.cfg.SessionDuration.Seconds()), "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (a *AuthController) Logout(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(a.cfg.AuthCookieName, "", -1, "/", "", false, true)
	c.Status(http.StatusNoContent)
}
