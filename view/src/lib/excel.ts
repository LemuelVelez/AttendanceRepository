import * as XLSX from "xlsx"
import type { WorkbookSheet } from "@/lib/types"

function makeUniqueHeaders(values: unknown[], columnCount: number) {
  const seen = new Map<string, number>()
  return Array.from({ length: columnCount }, (_, index) => {
    const base = String(values[index] ?? "").trim() || `Column ${index + 1}`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return count === 1 ? base : `${base} (${count})`
  })
}

export async function readXlsx(file: File): Promise<WorkbookSheet[]> {
  if (file.name.toLowerCase().endsWith(".xlsx") === false) {
    throw new Error("Only .xlsx files are accepted")
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false })

  return workbook.SheetNames.map((name) => {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
      dateNF: "yyyy-mm-dd hh:mm:ss",
    })
    const columnCount = matrix.reduce((max, row) => Math.max(max, row.length), 0)
    if (columnCount === 0) return { name, headers: [], rows: [] }

    const headers = makeUniqueHeaders(matrix[0] ?? [], columnCount)
    const rows = matrix.slice(1).flatMap((values) => {
      const row: Record<string, string> = {}
      let hasValue = false
      headers.forEach((header, index) => {
        const value = String(values[index] ?? "").trim()
        if (value) hasValue = true
        row[header] = value
      })
      return hasValue ? [row] : []
    })
    return { name, headers, rows }
  })
}
