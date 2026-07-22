package service

import (
	"bytes"
	"testing"

	"attendance-repository/model"
)

func TestWorkbookRoundTrip(t *testing.T) {
	input := []model.WorkbookSheet{{
		Name:    `Attendance & Summary`,
		Headers: []string{"Student ID", "Name", "Note"},
		Rows: []map[string]string{
			{"Student ID": "2026-001", "Name": "Ana & Ben", "Note": "Present <verified>"},
			{"Student ID": "2026-002", "Name": "José", "Note": ""},
		},
	}}
	payload, err := BuildWorkbook(input)
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := ParseWorkbook(bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	if parsed.RowCount != 2 || len(parsed.Sheets) != 1 {
		t.Fatalf("unexpected workbook: %#v", parsed)
	}
	if got := parsed.Sheets[0].Rows[0]["Name"]; got != "Ana & Ben" {
		t.Fatalf("unexpected cell value %q", got)
	}
}
