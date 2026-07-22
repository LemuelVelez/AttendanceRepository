import * as React from "react"
import { Edit3, LoaderCircle, Save } from "lucide-react"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { WorkbookSheet } from "@/lib/types"

function cloneSheets(sheets: WorkbookSheet[]) {
  return sheets.map((sheet) => ({
    ...sheet,
    headers: [...sheet.headers],
    rows: sheet.rows.map((row) => ({ ...row })),
  }))
}

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

  React.useEffect(() => {
    if (open) {
      setDraft(cloneSheets(sheets))
      setEditing(false)
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

  const save = async () => {
    await onSave?.(draft)
    setEditing(false)
  }

  const activeSheets = editing ? draft : sheets
  const firstSheet = activeSheets[0]?.name

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-[96vw] flex-col overflow-hidden lg:max-w-6xl">
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {activeSheets.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No readable sheets.</div>
        ) : (
          <Tabs defaultValue={firstSheet} className="flex min-h-0 flex-1 flex-col">
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
              <TabsContent key={sheet.name} value={sheet.name} className="min-h-0 flex-1 overflow-hidden">
                <div className="h-[58vh] overflow-auto rounded-md border">
                  <Table className="min-w-max">
                    <TableHeader className="sticky top-0 z-10 bg-primary text-primary-foreground">
                      <TableRow className="hover:bg-primary">
                        <TableHead className="w-16 text-primary-foreground">#</TableHead>
                        {sheet.headers.map((header) => (
                          <TableHead key={header} className="min-w-48 text-primary-foreground">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheet.rows.map((row, rowIndex) => (
                        <TableRow key={`${sheet.name}-${rowIndex}`}>
                          <TableCell className="font-medium text-muted-foreground">{rowIndex + 2}</TableCell>
                          {sheet.headers.map((header) => (
                            <TableCell key={header} className="max-w-80 whitespace-pre-wrap align-top">
                              {editing ? (
                                <Input
                                  value={row[header] ?? ""}
                                  onChange={(event) => updateCell(sheetIndex, rowIndex, header, event.target.value)}
                                  className="min-w-44"
                                />
                              ) : (
                                row[header] || <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        <DialogFooter className="gap-2 sm:space-x-0">
          {footer}
          {editable && !editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Edit3 className="h-4 w-4" />
              Edit cells
            </Button>
          ) : null}
          {editable && editing ? (
            <>
              <Button variant="outline" onClick={() => { setDraft(cloneSheets(sheets)); setEditing(false) }} disabled={saving}>
                Cancel edits
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
