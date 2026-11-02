package controller

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"attendance-repository/config"
	"attendance-repository/database"
	postgresstore "attendance-repository/database/postgres"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PenalyzeSyncController struct {
	cfg   config.Config
	store *postgresstore.Store
}

func NewPenalyzeSyncController(cfg config.Config, store *postgresstore.Store) *PenalyzeSyncController {
	return &PenalyzeSyncController{cfg: cfg, store: store}
}

type penalyzeSyncRequest struct {
	UploadIDs        []string `json:"uploadIds" binding:"required"`
	MarkedBy         string   `json:"markedBy"`
	PenalyzeImportID *string  `json:"penalyzeImportId"`
	Note             string   `json:"note"`
}

func (r *PenalyzeSyncController) readRequest(c *gin.Context) (penalyzeSyncRequest, bool) {
	var req penalyzeSyncRequest
	if !bindJSON(c, &req) {
		return req, false
	}
	if len(req.UploadIDs) < 1 || len(req.UploadIDs) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "uploadIds must contain 1 to 200 IDs"})
		return req, false
	}
	for _, id := range req.UploadIDs {
		if _, err := uuid.Parse(strings.TrimSpace(id)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "each upload ID must be a UUID"})
			return req, false
		}
	}
	if len(req.Note) > 4000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "note must be at most 4000 characters"})
		return req, false
	}
	if req.PenalyzeImportID != nil && strings.TrimSpace(*req.PenalyzeImportID) != "" {
		if _, err := uuid.Parse(strings.TrimSpace(*req.PenalyzeImportID)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "penalyzeImportId must be a UUID"})
			return req, false
		}
	}
	return req, true
}

func (r *PenalyzeSyncController) List(c *gin.Context) {
	status := strings.ToLower(strings.TrimSpace(c.DefaultQuery("status", "all")))
	switch status {
	case "all", "untracked", "pending", "uploaded", "outdated":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}
	uploads, err := r.store.ListPenalyzeSyncCandidates(c.Request.Context(), status)
	if err != nil {
		r.respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"uploads": uploads})
}

func (r *PenalyzeSyncController) Download(c *gin.Context) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid upload ID"})
		return
	}
	upload, workbook, err := r.store.GetRepository(c.Request.Context(), id)
	if err != nil {
		r.respondError(c, err)
		return
	}
	writeWorkbookDownload(c, upload, workbook)
}

func (r *PenalyzeSyncController) MarkPending(c *gin.Context) {
	req, ok := r.readRequest(c)
	if !ok {
		return
	}
	if strings.TrimSpace(req.MarkedBy) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "markedBy is required"})
		return
	}
	err := r.store.MarkPenalyzePending(c.Request.Context(), req.UploadIDs, req.MarkedBy, time.Now().In(r.cfg.Location))
	if err != nil {
		r.respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "marked pending", "uploadIds": req.UploadIDs})
}

func (r *PenalyzeSyncController) MarkUploaded(c *gin.Context) {
	req, ok := r.readRequest(c)
	if !ok {
		return
	}
	if strings.TrimSpace(req.MarkedBy) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "markedBy is required"})
		return
	}
	err := r.store.MarkPenalyzeUploaded(c.Request.Context(), req.UploadIDs, req.MarkedBy, req.PenalyzeImportID, req.Note, time.Now().In(r.cfg.Location))
	if err != nil {
		r.respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "marked uploaded", "uploadIds": req.UploadIDs})
}

func (r *PenalyzeSyncController) Reset(c *gin.Context) {
	req, ok := r.readRequest(c)
	if !ok {
		return
	}
	if err := r.store.ResetPenalyzeSync(c.Request.Context(), req.UploadIDs); err != nil {
		r.respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "sync status reset", "uploadIds": req.UploadIDs})
}

func (r *PenalyzeSyncController) respondError(c *gin.Context, err error) {
	if errors.Is(err, database.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "penalyze sync operation failed"})
}
