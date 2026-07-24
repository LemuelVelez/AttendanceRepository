import * as React from "react"
import { CalendarClock, Download, Edit3, Eye, FileSpreadsheet, LoaderCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { WorkbookDialog } from "@/components/WorkbookDialog"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api"
import type { UploadDetail, UploadRecord, WorkbookSheet } from "@/lib/types"
import { formatBytes, formatDateTime, formatUploadGroup } from "@/lib/utils"

type RepositoryListProps = {
  uploads: UploadRecord[]
  admin: boolean
  loading: boolean
  onChanged: () => Promise<void> | void
}

type DetailMode = "read" | "download"
type MetadataConfirmation = "save" | "discard" | null

export function RepositoryList({ uploads, admin, loading, onChanged }: RepositoryListProps) {
  const [detail, setDetail] = React.useState<UploadDetail | null>(null)
  const [detailMode, setDetailMode] = React.useState<DetailMode>("read")
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [savingWorkbook, setSavingWorkbook] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<UploadRecord | null>(null)
  const [editCollege, setEditCollege] = React.useState("")
  const [savingMetadata, setSavingMetadata] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<UploadRecord | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [metadataConfirmation, setMetadataConfirmation] = React.useState<MetadataConfirmation>(null)

  const grouped = React.useMemo(() => {
    const groups = new Map<string, UploadRecord[]>()
    uploads.forEach((upload) => {
      const key = formatUploadGroup(upload.uploadedAt)
      groups.set(key, [...(groups.get(key) ?? []), upload])
    })
    return Array.from(groups.entries())
  }, [uploads])

  const openDetail = async (upload: UploadRecord, mode: DetailMode = "read") => {
    setDetail(null)
    setDetailMode(mode)
    setDetailLoading(true)
    setDetailOpen(true)
    try {
      const response = await api.getUpload(upload.id)
      setDetail(response)
    } catch (error) {
      setDetailOpen(false)
      toast.error(error instanceof Error ? error.message : "Load failed")
    } finally {
      setDetailLoading(false)
    }
  }

  const openMetadataEditor = (upload: UploadRecord) => {
    setEditTarget(upload)
    setEditCollege(upload.college)
  }

  const saveMetadata = async () => {
    if (!editTarget) return
    const targetID = editTarget.id
    setSavingMetadata(true)
    try {
      await api.updateUpload(targetID, { college: editCollege })
      toast.success("Repository metadata updated")
      setMetadataConfirmation(null)
      setEditTarget(null)
      await onChanged()
      if (detail?.upload.id === targetID) {
        setDetail(await api.getUpload(targetID))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed")
    } finally {
      setSavingMetadata(false)
    }
  }

  const hasMetadataChanges = Boolean(
    editTarget && editCollege.trim() !== editTarget.college.trim(),
  )

  const closeMetadataEditor = () => {
    setMetadataConfirmation(null)
    setEditTarget(null)
    setEditCollege("")
  }

  const requestCloseMetadataEditor = () => {
    if (savingMetadata) return
    if (hasMetadataChanges) {
      setMetadataConfirmation("discard")
      return
    }
    closeMetadataEditor()
  }

  const confirmMetadataAction = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (metadataConfirmation === "save") {
      await saveMetadata()
      return
    }
    closeMetadataEditor()
  }

  const saveWorkbook = async (sheets: WorkbookSheet[]) => {
    if (!detail) return
    setSavingWorkbook(true)
    try {
      const response = await api.updateUpload(detail.upload.id, {
        college: detail.upload.college,
        sheets,
      })
      if ("sheets" in response) setDetail(response)
      else setDetail(await api.getUpload(detail.upload.id))
      toast.success("Workbook cells updated")
      await onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workbook update failed")
      throw error
    } finally {
      setSavingWorkbook(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteUpload(deleteTarget.id)
      toast.success("Repository data deleted")
      if (detail?.upload.id === deleteTarget.id) {
        setDetail(null)
        setDetailOpen(false)
      }
      setDeleteTarget(null)
      await onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-48 place-items-center rounded-xl border bg-card">
        <LoaderCircle className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  if (uploads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/70 p-12 text-center">
        <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 font-semibold">No saved attendance data</h3>
        <p className="mt-2 text-sm text-muted-foreground">Imported workbook rows will appear here.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-8">
        {grouped.map(([date, records]) => (
          <section key={date} className="space-y-3">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">{date}</h3>
              <Badge variant="secondary">{records.length}</Badge>
              <Separator className="flex-1" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {records.map((upload) => (
                <Card key={upload.id} className="overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-primary/10 p-3 text-primary">
                        <FileSpreadsheet className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold" title={upload.originalName}>{upload.originalName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{upload.college}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">Uploaded: {formatDateTime(upload.uploadedAt)}</Badge>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {upload.rowCount} rows · {upload.sheetCount} sheets · generated file {formatBytes(upload.sizeBytes)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => void openDetail(upload)}>
                        <Eye className="h-4 w-4" /> Read
                      </Button>
                      {admin ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openMetadataEditor(upload)}>
                            <Edit3 className="h-4 w-4" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            title="Preview before download"
                            aria-label={`Preview and download ${upload.originalName}`}
                            onClick={() => void openDetail(upload, "download")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                      <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(upload)}>
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      {detailLoading && !detail ? (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Loading workbook data</DialogTitle>
              <DialogDescription>Reading saved rows from the database.</DialogDescription>
            </DialogHeader>
            <div className="grid h-40 place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-primary" /></div>
          </DialogContent>
        </Dialog>
      ) : null}

      {detail ? (
        <WorkbookDialog
          open={detailOpen}
          onOpenChange={(open) => { setDetailOpen(open); if (!open) setDetail(null) }}
          title={detailMode === "download" ? `Download preview: ${detail.upload.originalName}` : detail.upload.originalName}
          description={`${detail.upload.college} · Uploaded ${formatDateTime(detail.upload.uploadedAt)}`}
          sheets={detail.sheets}
          editable={admin && detailMode === "read"}
          saving={savingWorkbook}
          onSave={saveWorkbook}
          footer={detailMode === "download" && admin ? (
            <Button asChild>
              <a href={`/api/repositories/${detail.upload.id}/download`}>
                <Download className="h-4 w-4" /> Download .xlsx
              </a>
            </Button>
          ) : undefined}
        />
      ) : null}

      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) requestCloseMetadataEditor()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit upload details</DialogTitle>
            <DialogDescription>Change repository metadata. Use Read → Edit cells to modify saved workbook data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-college">College</Label>
              <Input id="edit-college" value={editCollege} onChange={(event) => setEditCollege(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={requestCloseMetadataEditor} disabled={savingMetadata}>Cancel</Button>
            <Button
              onClick={() => setMetadataConfirmation("save")}
              disabled={savingMetadata || !editCollege.trim() || !hasMetadataChanges}
            >
              {savingMetadata ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Save details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(metadataConfirmation)}
        onOpenChange={(open) => {
          if (!open && !savingMetadata) setMetadataConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {metadataConfirmation === "save" ? "Save repository details?" : "Discard repository changes?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {metadataConfirmation === "save"
                ? `This will change the college for ${editTarget?.originalName} to ${editCollege.trim()}.`
                : "Your unsaved repository detail changes will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingMetadata}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                metadataConfirmation === "save"
                  ? undefined
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
              onClick={confirmMetadataAction}
              disabled={savingMetadata}
            >
              {savingMetadata ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {metadataConfirmation === "save" ? "Save details" : "Discard changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved attendance data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {deleteTarget?.originalName} and all imported database rows.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(event) => { event.preventDefault(); void remove() }} disabled={deleting}>
              {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
