package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"attendance-repository/model"
	"attendance-repository/service"
	"github.com/gin-gonic/gin"
)

// writeWorkbookDownload is shared by both the cookie-authenticated repository route
// and the integration-key route, ensuring identical Excel exports.
func writeWorkbookDownload(c *gin.Context, upload model.Upload, workbook model.ParsedWorkbook) {
	payload, err := service.BuildWorkbook(workbook.Sheets)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "build workbook failed"})
		return
	}
	asciiFilename := service.SafeFileName(upload.OriginalName)
	encodedFilename := strings.ReplaceAll(url.QueryEscape(upload.OriginalName), "+", "%20")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`, asciiFilename, encodedFilename))
	c.Header("Cache-Control", "no-store")
	c.Data(http.StatusOK, xlsxContentType, payload)
}
