import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date)
}

export function formatUploadGroup(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown date"
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(date)
}

const repositoryRepresentativeMarker = " - College Representative: "
const repositoryExtension = ".xlsx"
const maxRepositoryFilenameLength = 255

function sanitizeRepositoryFilenamePart(value: string) {
  return Array.from(value.trim())
    .filter((char) => {
      if (char === "/" || char === "\\") return false
      const code = char.codePointAt(0) ?? 0
      return !((code >= 0 && code <= 31) || (code >= 127 && code <= 159))
    })
    .join("")
    .trim()
}

export function repositoryFilenamePreview(title: string, representativeName: string) {
  const safeTitle = sanitizeRepositoryFilenamePart(title)
  const safeRepresentative = sanitizeRepositoryFilenamePart(representativeName)
  if (!safeTitle || !safeRepresentative) return ""

  const suffix = `${repositoryRepresentativeMarker}${safeRepresentative}${repositoryExtension}`
  const maxTitleLength = maxRepositoryFilenameLength - Array.from(suffix).length
  if (maxTitleLength < 1) return ""

  const truncatedTitle = Array.from(safeTitle).slice(0, maxTitleLength).join("").trim()
  if (!truncatedTitle) return ""
  return `${truncatedTitle}${suffix}`
}

export function parseRepositoryFilename(name: string) {
  const trimmedName = name.trim()
  const lowerName = trimmedName.toLowerCase()
  if (!lowerName.endsWith(repositoryExtension)) {
    return { title: trimmedName, representativeName: "" }
  }

  const base = trimmedName.slice(0, -repositoryExtension.length).trim()
  const markerIndex = base.lastIndexOf(repositoryRepresentativeMarker)
  if (markerIndex <= 0) {
    return { title: base, representativeName: "" }
  }

  const title = base.slice(0, markerIndex).trim()
  const representativeName = base.slice(markerIndex + repositoryRepresentativeMarker.length).trim()
  if (!title || !representativeName) {
    return { title: base, representativeName: "" }
  }
  return { title, representativeName }
}

export function fileTitleWithoutXlsx(name: string) {
  const trimmedName = name.trim()
  return trimmedName.toLowerCase().endsWith(repositoryExtension)
    ? trimmedName.slice(0, -repositoryExtension.length).trim()
    : trimmedName
}
