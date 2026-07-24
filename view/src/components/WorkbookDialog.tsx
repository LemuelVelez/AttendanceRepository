import * as React from "react"
import { ChevronDown, Edit3, LoaderCircle, Save, Search } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { WorkbookSheet } from "@/lib/types"

function cloneSheets(sheets: WorkbookSheet[]) {
  return sheets.map((sheet) => ({
    ...sheet,
    headers: [...sheet.headers],
    rows: sheet.rows.map((row) => ({ ...row })),
  }))
}

function normalizeHeader(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "")
}

function findHeader(headers: string[], exactMatches: string[], partialMatches: string[]) {
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeHeader(header) }))
  const exact = normalizedHeaders.find(({ normalized }) => exactMatches.includes(normalized))
  if (exact) return exact.header

  return normalizedHeaders.find(({ normalized }) => partialMatches.some((match) => normalized.includes(match)))?.header
}

function getStudentHeaders(headers: string[]) {
  return {
    studentIdHeader: findHeader(
      headers,
      ["studentid", "studentnumber", "studentno", "idnumber", "idno", "learnerid", "schoolid"],
      ["studentid", "studentnumber", "studentno", "idnumber", "learnerid"],
    ),
    studentNameHeader: findHeader(
      headers,
      ["name", "fullname", "studentname", "nameofstudent", "learnername"],
      ["studentname", "fullname", "learnername", "nameofstudent"],
    ),
  }
}

type GroupedWorkbookRow = {
  key: string
  studentId: string
  studentName: string
  rows: Array<{ row: Record<string, string>; rowIndex: number }>
}

function groupRowsByStudent(sheet: WorkbookSheet, searchQuery: string): GroupedWorkbookRow[] {
  const { studentIdHeader, studentNameHeader } = getStudentHeaders(sheet.headers)
  const query = searchQuery.trim().toLocaleLowerCase()
  const groups = new Map<string, GroupedWorkbookRow>()

  sheet.rows.forEach((row, rowIndex) => {
    const studentId = studentIdHeader ? row[studentIdHeader]?.trim() ?? "" : ""
    const studentName = studentNameHeader ? row[studentNameHeader]?.trim() ?? "" : ""
    const searchableValues = [studentId, studentName]

    if (query && !searchableValues.some((value) => value.toLocaleLowerCase().includes(query))) return

    const groupKey = studentId || `row-${rowIndex}`
    const existing = groups.get(groupKey)

    if (existing) {
      existing.rows.push({ row, rowIndex })
      if (!existing.studentName && studentName) existing.studentName = studentName
      return
    }

    groups.set(groupKey, {
      key: groupKey,
      studentId: studentId || `Row ${rowIndex + 2}`,
      studentName,
      rows: [{ row, rowIndex }],
    })
  })

  return Array.from(groups.values())
}

type WorkbookSheetAccordionProps = {
  sheet: WorkbookSheet
  sheetIndex: number
  editing: boolean
  searchQuery: string
  updateCell: (sheetIndex: number, rowIndex: number, header: string, value: string) => void
}

function WorkbookSheetAccordion({
  sheet,
  sheetIndex,
  editing,
  searchQuery,
  updateCell,
}: WorkbookSheetAccordionProps) {
  const groups = React.useMemo(() => groupRowsByStudent(sheet, searchQuery), [searchQuery, sheet])

  if (groups.length === 0) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
        No matching student records found.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <details key={group.key} className="group overflow-hidden rounded-xl border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold">{group.studentId}</p>
              {group.studentName ? <p className="mt-0.5 break-words text-sm text-muted-foreground">{group.studentName}</p> : null}
            </div>
            {group.rows.length > 1 ? (
              <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                {group.rows.length} records
              </span>
            ) : null}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>

          <div className="border-t p-4">
            <div className="space-y-5">
              {group.rows.map(({ row, rowIndex }, recordIndex) => (
                <section key={`${group.key}-${rowIndex}`} className={recordIndex > 0 ? "border-t pt-5" : undefined}>
                  {group.rows.length > 1 ? <p className="mb-3 text-sm font-medium">Record {recordIndex + 1}</p> : null}
                  <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {sheet.headers.map((header) => (
                      <div key={header} className="min-w-0 space-y-1.5">
                        <dt className="break-words text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {header}
                        </dt>
                        <dd className="min-w-0 break-words text-sm">
                          {editing ? (
                            <Input
                              value={row[header] ?? ""}
                              onChange={(event) => updateCell(sheetIndex, rowIndex, header, event.target.value)}
                              className="w-full"
                            />
                          ) : (
                            row[header] || <span className="text-muted-foreground">—</span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </div>
        </details>
      ))}
    </div>
  )
}

type WorkbookConfirmation = "save" | "discard" | "discard-and-close" | null

type WorkbookDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  sheets: WorkbookSheet[]
  editable?: boolean
  saving?: boolean
  footer?: React.ReactNode
  onSave?: (sheets: WorkbookSheet[]) => Promise<void> | void
}

export function WorkbookDialog({
  open,
  onOpenChange,
  title,
  description,
  sheets,
  editable = false,
  saving = false,
  footer,
  onSave,
}: WorkbookDialogProps) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState<WorkbookSheet[]>(() => cloneSheets(sheets))
  const [mobileSheetIndex, setMobileSheetIndex] = React.useState("0")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [confirmation, setConfirmation] = React.useState<WorkbookConfirmation>(null)

  React.useEffect(() => {
    if (open) {
      setDraft(cloneSheets(sheets))
      setEditing(false)
      setMobileSheetIndex("0")
      setSearchQuery("")
      setConfirmation(null)
    }
  }, [open, sheets])

  const updateCell = (sheetIndex: number, rowIndex: number, header: string, value: string) => {
    setDraft((current) =>
      current.map((sheet, currentSheetIndex) => {
        if (currentSheetIndex !== sheetIndex) return sheet
        return {
          ...sheet,
          rows: sheet.rows.map((row, currentRowIndex) =>
            currentRowIndex === rowIndex ? { ...row, [header]: value } : row,
          ),
        }
      }),
    )
  }

  const hasUnsavedChanges = React.useMemo(() => JSON.stringify(draft) !== JSON.stringify(sheets), [draft, sheets])

  const resetDraft = () => {
    setDraft(cloneSheets(sheets))
    setEditing(false)
  }

  const requestClose = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true)
      return
    }
    if (editing && hasUnsavedChanges) {
      setConfirmation("discard-and-close")
      return
    }
    resetDraft()
    onOpenChange(false)
  }

  const requestDiscard = () => {
    if (!hasUnsavedChanges) {
      resetDraft()
      return
    }
    setConfirmation("discard")
  }

  const requestSave = () => {
    if (!hasUnsavedChanges) {
      setEditing(false)
      return
    }
    setConfirmation("save")
  }

  const confirmWorkbookAction = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()

    if (confirmation === "save") {
      try {
        await onSave?.(draft)
        setEditing(false)
        setConfirmation(null)
      } catch {
        // The save handler reports the error and the confirmation stays open for retry.
      }
      return
    }

    const shouldClose = confirmation === "discard-and-close"
    resetDraft()
    setConfirmation(null)
    if (shouldClose) onOpenChange(false)
  }

  const activeSheets = editing ? draft : sheets
  const firstSheet = activeSheets[0]?.name
  const selectedMobileSheetIndex = Math.min(Number(mobileSheetIndex) || 0, Math.max(activeSheets.length - 1, 0))
  const selectedMobileSheet = activeSheets[selectedMobileSheetIndex]

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="flex h-[100dvh] w-full max-w-none flex-col gap-4 overflow-hidden rounded-none border-0 p-4 sm:h-auto sm:max-h-[92vh] sm:w-[calc(100%-2rem)] sm:max-w-[96vw] sm:rounded-lg sm:border sm:p-6 lg:max-w-6xl">
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {activeSheets.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No readable sheets.</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="relative shrink-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search student ID or name"
                aria-label="Search student ID or name"
                className="pl-9"
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 md:hidden">
              <Select value={String(selectedMobileSheetIndex)} onValueChange={setMobileSheetIndex}>
                <SelectTrigger aria-label="Select workbook sheet">
                  <SelectValue placeholder="Select a sheet" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  {activeSheets.map((sheet, sheetIndex) => (
                    <SelectItem key={`${sheet.name}-${sheetIndex}`} value={String(sheetIndex)}>
                      {sheet.name} ({sheet.rows.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {selectedMobileSheet ? (
                  <WorkbookSheetAccordion
                    sheet={selectedMobileSheet}
                    sheetIndex={selectedMobileSheetIndex}
                    editing={editing}
                    searchQuery={searchQuery}
                    updateCell={updateCell}
                  />
                ) : null}
              </div>
            </div>

            <Tabs defaultValue={firstSheet} className="hidden min-h-0 flex-1 flex-col md:flex">
              <ScrollArea className="w-full shrink-0 whitespace-nowrap pb-2">
                <TabsList className="w-max">
                  {activeSheets.map((sheet) => (
                    <TabsTrigger key={sheet.name} value={sheet.name}>
                      {sheet.name} ({sheet.rows.length})
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              {activeSheets.map((sheet, sheetIndex) => (
                <TabsContent key={sheet.name} value={sheet.name} className="min-h-0 flex-1 overflow-y-auto pr-2">
                  <WorkbookSheetAccordion
                    sheet={sheet}
                    sheetIndex={sheetIndex}
                    editing={editing}
                    searchQuery={searchQuery}
                    updateCell={updateCell}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2 sm:flex-wrap sm:space-x-0">
          {footer}
          {editable && !editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Edit3 className="h-4 w-4" />
              Edit cells
            </Button>
          ) : null}
          {editable && editing ? (
            <>
              <Button variant="outline" onClick={requestDiscard} disabled={saving}>
                Cancel edits
              </Button>
              <Button onClick={requestSave} disabled={saving || !hasUnsavedChanges}>
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
            </>
          ) : null}
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !saving) setConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation === "save" ? "Save workbook changes?" : "Discard workbook changes?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation === "save"
                ? "This will update the saved workbook data in the repository."
                : "All unsaved cell changes in this workbook will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmation === "save"
                  ? undefined
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
              onClick={confirmWorkbookAction}
              disabled={saving}
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {confirmation === "save" ? "Save changes" : "Discard changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
