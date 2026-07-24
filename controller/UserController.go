package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

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

type updateAdminRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"omitempty,min=8"`
}

func (u *UserController) Me(c *gin.Context) {
	user, ok := middleware.CurrentUser(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"user": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (u *UserController) ListAdmins(c *gin.Context) {
	users, err := u.store.ListUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list admins failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}

func (u *UserController) GetAdmin(c *gin.Context) {
	id, ok := parseUserID(c)
	if !ok {
		return
	}

	user, err := u.store.GetUserByID(c.Request.Context(), id)
	if err != nil {
		writeUserStoreError(c, err, "get admin failed")
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (u *UserController) CreateAdmin(c *gin.Context) {
	var request createAdminRequest
	if !bindJSON(c, &request) {
		return
	}

	passwordHash, err := hashPassword(request.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user := model.User{
		Email:        normalizeUserEmail(request.Email),
		PasswordHash: passwordHash,
		Role:         model.AdminRole,
	}
	if err := u.store.CreateUser(c.Request.Context(), &user); err != nil {
		writeUserStoreError(c, err, "create admin failed")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"user": user})
}

func (u *UserController) UpdateAdmin(c *gin.Context) {
	id, ok := parseUserID(c)
	if !ok {
		return
	}

	var request updateAdminRequest
	if !bindJSON(c, &request) {
		return
	}

	user, err := u.store.GetUserByID(c.Request.Context(), id)
	if err != nil {
		writeUserStoreError(c, err, "update admin failed")
		return
	}

	user.Email = normalizeUserEmail(request.Email)
	if request.Password != "" {
		user.PasswordHash, err = hashPassword(request.Password)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	if err := u.store.UpdateUser(c.Request.Context(), &user); err != nil {
		writeUserStoreError(c, err, "update admin failed")
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (u *UserController) DeleteAdmin(c *gin.Context) {
	id, ok := parseUserID(c)
	if !ok {
		return
	}

	currentUser, ok := middleware.CurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "admin authentication required"})
		return
	}
	if currentUser.ID == id {
		c.JSON(http.StatusForbidden, gin.H{"error": "you cannot delete your own account"})
		return
	}

	if err := u.store.DeleteUser(c.Request.Context(), id); err != nil {
		writeUserStoreError(c, err, "delete admin failed")
		return
	}
	c.Status(http.StatusNoContent)
}

func parseUserID(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid admin id"})
		return 0, false
	}
	return uint(id), true
}

func normalizeUserEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if errors.Is(err, bcrypt.ErrPasswordTooLong) {
		return "", errors.New("password must not exceed 72 bytes")
	}
	if err != nil {
		return "", errors.New("password could not be secured")
	}
	return string(hash), nil
}

func writeUserStoreError(c *gin.Context, err error, fallback string) {
	switch {
	case errors.Is(err, database.ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "admin user not found"})
	case errors.Is(err, database.ErrConflict):
		c.JSON(http.StatusConflict, gin.H{"error": "an admin with this email already exists"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": fallback})
	}
}
