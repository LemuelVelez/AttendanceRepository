package controller

import (
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"attendance-repository/config"
	redisstore "attendance-repository/database/redis"
	"attendance-repository/model"
	"attendance-repository/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const xlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

type RepositoryController struct {
	cfg      config.Config
	store    *redisstore.Store
	previews *service.PreviewStore
}

func NewRepositoryController(cfg config.Config, store *redisstore.Store) *RepositoryController {
	return &RepositoryController{
		cfg:      cfg,
		store:    store,
		previews: service.NewPreviewStore(cfg.PreviewTTL),
	}
}

type commitPreviewRequest struct {
	PreviewID string `json:"previewId" binding:"required"`
}

type updateRepositoryRequest struct {
	College   *string                `json:"college"`
	EventDate *string                `json:"eventDate"`
	EventTime *string                `json:"eventTime"`
	Sheets    *[]model.WorkbookSheet `json:"sheets"`
}

func (r *RepositoryController) Preview(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, r.cfg.MaxUploadBytes+(1024*1024))

	college, eventDate, eventTime, err := validateMetadata(
		c.PostForm("college"),
		c.PostForm("eventDate"),
		c.PostForm("eventTime"),
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "an .xlsx file is required"})
		return
	}
	if fileHeader.Size <= 0 || fileHeader.Size > r.cfg.MaxUploadBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("file must be between 1 byte and %d bytes", r.cfg.MaxUploadBytes)})
		return
	}
	if strings.ToLower(filepath.Ext(fileHeader.Filename)) != ".xlsx" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only .xlsx files are accepted"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "open uploaded workbook failed"})
		return
	}
	defer file.Close()

	workbook, err := service.ParseWorkbook(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if workbook.RowCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "the workbook does not contain any data rows"})
		return
	}

	_ = r.previews.CleanupExpired()
	manifest := model.PreviewManifest{
		ID:           uuid.NewString(),
		OriginalName: service.SafeFileName(fileHeader.Filename),
		College:      college,
		EventDate:    eventDate,
		EventTime:    eventTime,
		SizeBytes:    fileHeader.Size,
		CreatedAt:    time.Now().In(r.cfg.Location),
		Workbook:     workbook,
	}
	if err := r.previews.Save(manifest); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save preview failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"preview": publicPreview(manifest)})
}

func (r *RepositoryController) DiscardPreview(c *gin.Context) {
	if err := r.previews.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "discard preview failed"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (r *RepositoryController) Create(c *gin.Context) {
	var request commitPreviewRequest
	if !bindJSON(c, &request) {
		return
	}

	manifest, err := r.previews.Load(strings.TrimSpace(request.PreviewID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	generated, err := service.BuildWorkbook(manifest.Workbook.Sheets)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	now := time.Now().In(r.cfg.Location)
	upload := model.Upload{
		ID:           uuid.NewString(),
		OriginalName: manifest.OriginalName,
		College:      manifest.College,
		EventDate:    manifest.EventDate,
		EventTime:    manifest.EventTime,
		UploadedAt:   now,
		UpdatedAt:    now,
		SizeBytes:    int64(len(generated)),
		SheetCount:   len(manifest.Workbook.Sheets),
		RowCount:     manifest.Workbook.RowCount,
	}

	if err := r.store.SaveRepository(c.Request.Context(), upload, manifest.Workbook); err != nil {
		writeDataStoreError(c, err)
		return
	}

	_ = r.previews.Delete(manifest.ID)
	c.JSON(http.StatusCreated, gin.H{"upload": upload})
}

func (r *RepositoryController) List(c *gin.Context) {
	uploads, err := r.store.ListRepositories(c.Request.Context())
	if err != nil {
		writeDataStoreError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"uploads": uploads})
}

func (r *RepositoryController) Get(c *gin.Context) {
	upload, workbook, err := r.loadWorkbook(c)
	if err != nil {
		writeDataStoreError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"upload": upload, "sheets": workbook.Sheets})
}

func (r *RepositoryController) Update(c *gin.Context) {
	var request updateRepositoryRequest
	if !bindJSON(c, &request) {
		return
	}

	upload, workbook, err := r.store.GetRepository(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeDataStoreError(c, err)
		return
	}

	college, eventDate, eventTime := upload.College, upload.EventDate, upload.EventTime
	if request.College != nil {
		college = *request.College
	}
	if request.EventDate != nil {
		eventDate = *request.EventDate
	}
	if request.EventTime != nil {
		eventTime = *request.EventTime
	}
	college, eventDate, eventTime, err = validateMetadata(college, eventDate, eventTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	upload.College = college
	upload.EventDate = eventDate
	upload.EventTime = eventTime
	upload.UpdatedAt = time.Now().In(r.cfg.Location)

	if request.Sheets != nil {
		workbook, err = normalizeWorkbook(*request.Sheets)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		generated, err := service.BuildWorkbook(workbook.Sheets)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		upload.SheetCount = len(workbook.Sheets)
		upload.RowCount = workbook.RowCount
		upload.SizeBytes = int64(len(generated))
	}

	if err := r.store.SaveRepository(c.Request.Context(), upload, workbook); err != nil {
		writeDataStoreError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"upload": upload, "sheets": workbook.Sheets})
}

func (r *RepositoryController) Delete(c *gin.Context) {
	if err := r.store.DeleteRepository(c.Request.Context(), c.Param("id")); err != nil {
		writeDataStoreError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (r *RepositoryController) Download(c *gin.Context) {
	upload, workbook, err := r.loadWorkbook(c)
	if err != nil {
		writeDataStoreError(c, err)
		return
	}
	payload, err := service.BuildWorkbook(workbook.Sheets)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	filename := service.SafeFileName(upload.OriginalName)
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("Cache-Control", "no-store")
	c.Data(http.StatusOK, xlsxContentType, payload)
}

func (r *RepositoryController) loadWorkbook(c *gin.Context) (model.Upload, model.ParsedWorkbook, error) {
	return r.store.GetRepository(c.Request.Context(), c.Param("id"))
}

func normalizeWorkbook(sheets []model.WorkbookSheet) (model.ParsedWorkbook, error) {
	if len(sheets) == 0 {
		return model.ParsedWorkbook{}, errors.New("at least one sheet is required")
	}
	workbook := model.ParsedWorkbook{Sheets: make([]model.WorkbookSheet, 0, len(sheets))}
	seenSheetNames := make(map[string]struct{}, len(sheets))
	for sheetIndex, sheet := range sheets {
		name := strings.TrimSpace(sheet.Name)
		if name == "" {
			name = fmt.Sprintf("Sheet%d", sheetIndex+1)
		}
		if _, exists := seenSheetNames[name]; exists {
			return model.ParsedWorkbook{}, fmt.Errorf("duplicate sheet name %q", name)
		}
		seenSheetNames[name] = struct{}{}

		headers := make([]string, 0, len(sheet.Headers))
		seenHeaders := make(map[string]struct{}, len(sheet.Headers))
		for _, header := range sheet.Headers {
			header = strings.TrimSpace(header)
			if header == "" {
				return model.ParsedWorkbook{}, fmt.Errorf("sheet %q contains an empty header", name)
			}
			if _, exists := seenHeaders[header]; exists {
				return model.ParsedWorkbook{}, fmt.Errorf("sheet %q contains duplicate header %q", name, header)
			}
			seenHeaders[header] = struct{}{}
			headers = append(headers, header)
		}
		if len(headers) == 0 {
			return model.ParsedWorkbook{}, fmt.Errorf("sheet %q has no headers", name)
		}

		rows := make([]map[string]string, 0, len(sheet.Rows))
		for _, inputRow := range sheet.Rows {
			row := make(map[string]string, len(headers))
			for _, header := range headers {
				row[header] = strings.TrimSpace(inputRow[header])
			}
			rows = append(rows, row)
		}
		workbook.Sheets = append(workbook.Sheets, model.WorkbookSheet{Name: name, Headers: headers, Rows: rows})
		workbook.RowCount += len(rows)
	}
	return workbook, nil
}

func validateMetadata(college, eventDate, eventTime string) (string, string, string, error) {
	college = strings.TrimSpace(college)
	eventDate = strings.TrimSpace(eventDate)
	eventTime = strings.TrimSpace(eventTime)
	if college == "" {
		return "", "", "", errors.New("college is required")
	}
	if _, err := time.Parse("2006-01-02", eventDate); err != nil {
		return "", "", "", errors.New("event date must use YYYY-MM-DD")
	}
	parsedTime, err := parseClock(eventTime)
	if err != nil {
		return "", "", "", errors.New("event time must use HH:MM")
	}
	return college, eventDate, parsedTime, nil
}

func parseClock(value string) (string, error) {
	for _, layout := range []string{"15:04", "15:04:05"} {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return parsed.Format("15:04"), nil
		}
	}
	return "", errors.New("invalid time")
}

func publicPreview(manifest model.PreviewManifest) gin.H {
	return gin.H{
		"id":           manifest.ID,
		"originalName": manifest.OriginalName,
		"college":      manifest.College,
		"eventDate":    manifest.EventDate,
		"eventTime":    manifest.EventTime,
		"sizeBytes":    manifest.SizeBytes,
		"createdAt":    manifest.CreatedAt,
		"sheetCount":   len(manifest.Workbook.Sheets),
		"rowCount":     manifest.Workbook.RowCount,
		"sheets":       manifest.Workbook.Sheets,
	}
}
