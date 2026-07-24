package controller

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"attendance-repository/database"
	postgresstore "attendance-repository/database/postgres"
	"attendance-repository/middleware"
	"attendance-repository/model"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type UserController struct {
	store *postgresstore.Store
}

func NewUserController(store *postgresstore.Store) *UserController {
	return &UserController{store: store}
}

type createAdminRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

func (u *UserController) Me(c *gin.Context) {
	user, ok := middleware.CurrentUser(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"user": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (u *UserController) CreateAdmin(c *gin.Context) {
	var request createAdminRequest
	if !bindJSON(c, &request) {
		return
	}

	email := strings.ToLower(strings.TrimSpace(request.Email))
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create admin failed"})
		return
	}

	now := time.Now().UTC()
	user := model.User{
		Email:        email,
		PasswordHash: string(passwordHash),
		Role:         model.AdminRole,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := u.store.CreateUser(c.Request.Context(), &user); err != nil {
		if errors.Is(err, database.ErrConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": "an admin with this email already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create admin failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"user": user})
}
