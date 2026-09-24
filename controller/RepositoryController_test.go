package controller

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestBuildRepositoryFilename(t *testing.T) {
	t.Run("valid input", func(t *testing.T) {
		got, err := buildRepositoryFilename("  FRC September 07  ", "  John Doe  ")
		if err != nil {
			t.Fatalf("buildRepositoryFilename returned error: %v", err)
		}
		want := "FRC September 07 - College Representative: John Doe.xlsx"
		if got != want {
			t.Fatalf("got %q, want %q", got, want)
		}
	})

	t.Run("missing title", func(t *testing.T) {
		_, err := buildRepositoryFilename("   ", "John Doe")
		if err == nil || err.Error() != "title is required" {
			t.Fatalf("got error %v, want title is required", err)
		}
	})

	t.Run("missing representative", func(t *testing.T) {
		_, err := buildRepositoryFilename("FRC September 07", "   ")
		if err == nil || err.Error() != "college representative name is required" {
			t.Fatalf("got error %v, want college representative name is required", err)
		}
	})

	t.Run("strips path separators", func(t *testing.T) {
		got, err := buildRepositoryFilename(`F/R\C`, `John/\Doe`)
		if err != nil {
			t.Fatalf("buildRepositoryFilename returned error: %v", err)
		}
		want := "FRC - College Representative: JohnDoe.xlsx"
		if got != want {
			t.Fatalf("got %q, want %q", got, want)
		}
	})

	t.Run("long title truncates before representative", func(t *testing.T) {
		representative := "Alexandra Representative"
		got, err := buildRepositoryFilename(strings.Repeat("Long title ", 60), representative)
		if err != nil {
			t.Fatalf("buildRepositoryFilename returned error: %v", err)
		}
		wantSuffix := repositoryRepresentativeMarker + representative + repositoryExtension
		if !strings.HasSuffix(got, wantSuffix) {
			t.Fatalf("representative suffix was changed: %q", got)
		}
		if utf8.RuneCountInString(got) > maxRepositoryFilenameLength {
			t.Fatalf("filename length is %d runes, want <= %d", utf8.RuneCountInString(got), maxRepositoryFilenameLength)
		}
	})
}
