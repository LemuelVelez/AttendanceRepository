package service

import (
	"path/filepath"
	"regexp"
	"strings"
)

var unsafeFileChars = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

func SafeFileName(name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	name = unsafeFileChars.ReplaceAllString(name, "_")
	name = strings.Trim(name, "._-")
	if name == "" {
		return "attendance.xlsx"
	}
	if !strings.HasSuffix(strings.ToLower(name), ".xlsx") {
		name += ".xlsx"
	}
	return name
}
