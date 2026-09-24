package service

import (
	"path/filepath"
	"strings"
	"unicode"
)

func SafeFileName(name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, ":", " -")

	var cleaned strings.Builder
	for _, char := range name {
		switch {
		case char > unicode.MaxASCII:
			cleaned.WriteRune('_')
		case char == '/' || char == '\\' || unicode.IsControl(char) || strings.ContainsRune(`<>"|?*`, char):
			cleaned.WriteRune('_')
		default:
			cleaned.WriteRune(char)
		}
	}

	name = strings.TrimSpace(cleaned.String())
	name = strings.TrimRight(name, ". ")
	if name == "" {
		return "attendance.xlsx"
	}
	if !strings.HasSuffix(strings.ToLower(name), ".xlsx") {
		name += ".xlsx"
	}
	return name
}
