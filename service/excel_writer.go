package service

import (
	"fmt"
	"strings"

	"attendance-repository/model"
	"github.com/xuri/excelize/v2"
)

func BuildWorkbook(sheets []model.WorkbookSheet) ([]byte, error) {
	if len(sheets) == 0 {
		return nil, fmt.Errorf("at least one sheet is required")
	}

	book := excelize.NewFile()
	defer func() { _ = book.Close() }()

	defaultSheet := book.GetSheetName(0)
	usedNames := make(map[string]struct{}, len(sheets))
	for index, sheet := range sheets {
		name := uniqueSheetName(sheet.Name, index, usedNames)
		if index == 0 {
			book.SetSheetName(defaultSheet, name)
		} else if _, err := book.NewSheet(name); err != nil {
			return nil, fmt.Errorf("create sheet %q: %w", name, err)
		}

		for column, header := range sheet.Headers {
			cell, _ := excelize.CoordinatesToCellName(column+1, 1)
			if err := book.SetCellValue(name, cell, header); err != nil {
				return nil, err
			}
		}
		for rowIndex, row := range sheet.Rows {
			for column, header := range sheet.Headers {
				cell, _ := excelize.CoordinatesToCellName(column+1, rowIndex+2)
				if err := book.SetCellValue(name, cell, row[header]); err != nil {
					return nil, err
				}
			}
		}

		if err := styleSheet(book, name, sheet); err != nil {
			return nil, err
		}
	}

	buffer, err := book.WriteToBuffer()
	if err != nil {
		return nil, fmt.Errorf("build workbook: %w", err)
	}
	return buffer.Bytes(), nil
}

func uniqueSheetName(input string, index int, used map[string]struct{}) string {
	name := strings.TrimSpace(input)
	name = strings.NewReplacer("\\", " ", "/", " ", "?", " ", "*", " ", "[", " ", "]", " ", ":", " ").Replace(name)
	if name == "" {
		name = fmt.Sprintf("Sheet%d", index+1)
	}
	if len([]rune(name)) > 31 {
		name = string([]rune(name)[:31])
	}
	base := name
	for suffix := 2; ; suffix++ {
		if _, exists := used[name]; !exists {
			used[name] = struct{}{}
			return name
		}
		tail := fmt.Sprintf(" (%d)", suffix)
		maxBase := 31 - len([]rune(tail))
		trimmed := []rune(base)
		if len(trimmed) > maxBase {
			trimmed = trimmed[:maxBase]
		}
		name = string(trimmed) + tail
	}
}

func styleSheet(book *excelize.File, name string, sheet model.WorkbookSheet) error {
	if len(sheet.Headers) == 0 {
		return nil
	}

	lastColumn, _ := excelize.ColumnNumberToName(len(sheet.Headers))
	lastRow := len(sheet.Rows) + 1
	headerStyle, err := book.NewStyle(&excelize.Style{
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"78350F"}},
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 12},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
		Border: []excelize.Border{
			{Type: "left", Color: "D6D3D1", Style: 1},
			{Type: "right", Color: "D6D3D1", Style: 1},
			{Type: "top", Color: "D6D3D1", Style: 1},
			{Type: "bottom", Color: "D6D3D1", Style: 1},
		},
	})
	if err != nil {
		return err
	}
	bodyStyle, err := book.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Color: "111827", Size: 11},
		Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
		Border: []excelize.Border{
			{Type: "left", Color: "D6D3D1", Style: 1},
			{Type: "right", Color: "D6D3D1", Style: 1},
			{Type: "top", Color: "D6D3D1", Style: 1},
			{Type: "bottom", Color: "D6D3D1", Style: 1},
		},
	})
	if err != nil {
		return err
	}

	if err := book.SetCellStyle(name, "A1", lastColumn+"1", headerStyle); err != nil {
		return err
	}
	if lastRow > 1 {
		if err := book.SetCellStyle(name, "A2", fmt.Sprintf("%s%d", lastColumn, lastRow), bodyStyle); err != nil {
			return err
		}
	}
	if err := book.AutoFilter(name, fmt.Sprintf("A1:%s%d", lastColumn, lastRow), nil); err != nil {
		return err
	}
	if err := book.SetRowHeight(name, 1, 24); err != nil {
		return err
	}

	for columnIndex, header := range sheet.Headers {
		width := len([]rune(header)) + 3
		for _, row := range sheet.Rows {
			if current := len([]rune(row[header])) + 2; current > width {
				width = current
			}
		}
		if width < 12 {
			width = 12
		}
		if width > 34 {
			width = 34
		}
		column, _ := excelize.ColumnNumberToName(columnIndex + 1)
		if err := book.SetColWidth(name, column, column, float64(width)); err != nil {
			return err
		}
	}
	return nil
}
