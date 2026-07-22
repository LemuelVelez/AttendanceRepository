package service

import (
	"fmt"
	"io"
	"strings"

	"attendance-repository/model"
	"github.com/xuri/excelize/v2"
)

func ParseWorkbook(reader io.Reader) (model.ParsedWorkbook, error) {
	book, err := excelize.OpenReader(reader, excelize.Options{RawCellValue: false})
	if err != nil {
		return model.ParsedWorkbook{}, fmt.Errorf("open xlsx workbook: %w", err)
	}
	defer func() { _ = book.Close() }()

	workbook := model.ParsedWorkbook{Sheets: make([]model.WorkbookSheet, 0)}
	for _, sheetName := range book.GetSheetList() {
		rows, err := book.GetRows(sheetName, excelize.Options{RawCellValue: false})
		if err != nil {
			return model.ParsedWorkbook{}, fmt.Errorf("read sheet %q: %w", sheetName, err)
		}

		sheet := parseSheet(sheetName, rows)
		workbook.RowCount += len(sheet.Rows)
		workbook.Sheets = append(workbook.Sheets, sheet)
	}

	if len(workbook.Sheets) == 0 {
		return model.ParsedWorkbook{}, fmt.Errorf("the workbook has no readable sheets")
	}
	return workbook, nil
}

func parseSheet(name string, rows [][]string) model.WorkbookSheet {
	if len(rows) == 0 {
		return model.WorkbookSheet{Name: name, Headers: []string{}, Rows: []map[string]string{}}
	}

	columnCount := 0
	for _, row := range rows {
		if len(row) > columnCount {
			columnCount = len(row)
		}
	}
	if columnCount == 0 {
		return model.WorkbookSheet{Name: name, Headers: []string{}, Rows: []map[string]string{}}
	}

	headers := makeUniqueHeaders(rows[0], columnCount)
	parsedRows := make([]map[string]string, 0, len(rows)-1)
	for rowIndex := 1; rowIndex < len(rows); rowIndex++ {
		row := rows[rowIndex]
		data := make(map[string]string, columnCount)
		hasValue := false
		for columnIndex, header := range headers {
			value := ""
			if columnIndex < len(row) {
				value = strings.TrimSpace(row[columnIndex])
			}
			if value != "" {
				hasValue = true
			}
			data[header] = value
		}
		if hasValue {
			parsedRows = append(parsedRows, data)
		}
	}

	return model.WorkbookSheet{Name: name, Headers: headers, Rows: parsedRows}
}

func makeUniqueHeaders(headerRow []string, columnCount int) []string {
	headers := make([]string, columnCount)
	seen := make(map[string]int, columnCount)
	for index := 0; index < columnCount; index++ {
		header := ""
		if index < len(headerRow) {
			header = strings.TrimSpace(headerRow[index])
		}
		if header == "" {
			header = fmt.Sprintf("Column %d", index+1)
		}

		seen[header]++
		if seen[header] > 1 {
			header = fmt.Sprintf("%s (%d)", header, seen[header])
		}
		headers[index] = header
	}
	return headers
}
