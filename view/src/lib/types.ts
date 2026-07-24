export type User = {
  id: number
  email: string
  role: "admin"
  createdAt: string
  updatedAt: string
}

export type WorkbookSheet = {
  name: string
  headers: string[]
  rows: Record<string, string>[]
}

export type UploadRecord = {
  id: string
  originalName: string
  college: string
  uploadedAt: string
  updatedAt: string
  sizeBytes: number
  sheetCount: number
  rowCount: number
}

export type UploadDetail = {
  upload: UploadRecord
  sheets: WorkbookSheet[]
}

export type PreviewRecord = {
  id: string
  originalName: string
  college: string
  sizeBytes: number
  createdAt: string
  sheetCount: number
  rowCount: number
  sheets: WorkbookSheet[]
}
