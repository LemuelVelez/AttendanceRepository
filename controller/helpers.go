package controller

import (
	"errors"
	"net/http"

	"attendance-repository/database"
	"github.com/gin-gonic/gin"
)

func bindJSON(c *gin.Context, target any) bool {
	if err := c.ShouldBindJSON(target); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return false
	}
	return true
}

func writeDataStoreError(c *gin.Context, err error) {
	if errors.Is(err, database.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "data store operation failed"})
}
