package middleware

import (
	"net/http"
	"strconv"
	"time"

	"attendance-repository/config"
	redisstore "attendance-repository/database/redis"
	"attendance-repository/model"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const userContextKey = "currentUser"

type Claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

type Auth struct {
	cfg   config.Config
	store *redisstore.Store
}

func NewAuth(cfg config.Config, store *redisstore.Store) *Auth {
	return &Auth{cfg: cfg, store: store}
}

func (a *Auth) Sign(user model.User) (string, error) {
	now := time.Now()
	claims := Claims{
		Role: user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatUint(uint64(user.ID), 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(a.cfg.SessionDuration)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(a.cfg.JWTSecret))
}

func (a *Auth) Optional() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := a.resolveUser(c)
		if ok {
			c.Set(userContextKey, user)
		}
		c.Next()
	}
}

func (a *Auth) RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := a.resolveUser(c)
		if !ok || user.Role != model.AdminRole {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "admin authentication required"})
			return
		}
		c.Set(userContextKey, user)
		c.Next()
	}
}

func CurrentUser(c *gin.Context) (model.User, bool) {
	value, exists := c.Get(userContextKey)
	if !exists {
		return model.User{}, false
	}
	user, ok := value.(model.User)
	return user, ok
}

func (a *Auth) resolveUser(c *gin.Context) (model.User, bool) {
	tokenString, err := c.Cookie(a.cfg.AuthCookieName)
	if err != nil || tokenString == "" {
		return model.User{}, false
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(a.cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return model.User{}, false
	}

	id, err := strconv.ParseUint(claims.Subject, 10, 64)
	if err != nil {
		return model.User{}, false
	}

	user, err := a.store.GetUserByID(c.Request.Context(), uint(id))
	if err != nil {
		return model.User{}, false
	}
	return user, true
}
