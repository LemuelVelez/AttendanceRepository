import * as React from "react"
import {
  CalendarClock,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  LoaderCircle,
  Trash2,
  XCircle,
} from "lucide-react"
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
import type { RepositoryDeleteRequest, UploadDetail, UploadRecord, WorkbookSheet } from "@/lib/types"
import { formatBytes, formatDateTime, formatUploadGroup } from "@/lib/utils"

type RepositoryListProps = {
  uploads: UploadRecord[]
  admin: boolean
  loading: boolean
  onChanged: () => Promise<void> | void
}

type DetailMode = "read" | "download"
type MetadataConfirmation = "save" | "discard" | null
type FilenameOverrides = Record<string, string>

const filenameOverridesStorageKey = "attendance-repository-filename-overrides"

function readFilenameOverrides(): FilenameOverrides {
  if (typeof window === "undefined") return {}

  try {
    const stored = JSON.parse(window.localStorage.getItem(filenameOverridesStorageKey) ?? "{}") as unknown
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {}

    return Object.fromEntries(
      Object.entries(stored).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    )
  } catch {
    return {}
  }
}

function persistFilenameOverrides(overrides: FilenameOverrides) {
  if (typeof window === "undefined") return

  if (Object.keys(overrides).length === 0) {
    window.localStorage.removeItem(filenameOverridesStorageKey)
    return
  }

  window.localStorage.setItem(filenameOverridesStorageKey, JSON.stringify(overrides))
}

export function RepositoryList({ uploads, admin, loading, onChanged }: RepositoryListProps) {
  const [detail, setDetail] = React.useState<UploadDetail | null>(null)
  const [detailMode, setDetailMode] = React.useState<DetailMode>("read")
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [savingWorkbook, setSavingWorkbook] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<UploadRecord | null>(null)
  const [editFilename, setEditFilename] = React.useState("")
  const [editCollege, setEditCollege] = React.useState("")
  const [savingMetadata, setSavingMetadata] = React.useState(false)
  const [metadataConfirmation, setMetadataConfirmation] = React.useState<MetadataConfirmation>(null)
  const [filenameOverrides, setFilenameOverrides] = React.useState<FilenameOverrides>(readFilenameOverrides)
  const [downloadingID, setDownloadingID] = React.useState<string | null>(null)

  const [deleteRequestTarget, setDeleteRequestTarget] = React.useState<UploadRecord | null>(null)
  const [deleteReason, setDeleteReason] = React.useState("")
  const [submittingDeleteRequest, setSubmittingDeleteRequest] = React.useState(false)
  const [adminDeleteTarget, setAdminDeleteTarget] = React.useState<UploadRecord | null>(null)
  const [deletingAdminUploadID, setDeletingAdminUploadID] = React.useState<string | null>(null)
  const [deleteRequests, setDeleteRequests] = React.useState<RepositoryDeleteRequest[]>([])
  const [deleteRequestsLoading, setDeleteRequestsLoading] = React.useState(false)
  const [reviewRequest, setReviewRequest] = React.useState<RepositoryDeleteRequest | null>(null)
  const [rejectingRequestID, setRejectingRequestID] = React.useState<number | null>(null)
  const [deleteApprovalTarget, setDeleteApprovalTarget] = React.useState<RepositoryDeleteRequest | null>(null)
  const [deletingRequestID, setDeletingRequestID] = React.useState<number | null>(null)

  const getUploadFilename = React.useCallback(
    (upload: UploadRecord) => filenameOverrides[upload.id]?.trim() || upload.originalName,
    [filenameOverrides],
  )

  const setFilenameOverride = React.useCallback((id: string, filename?: string) => {
    setFilenameOverrides((current) => {
      const next = { ...current }
      if (filename?.trim()) next[id] = filename.trim()
      else delete next[id]
      persistFilenameOverrides(next)
      return next
    })
  }, [])

  React.useEffect(() => {
    setFilenameOverrides((current) => {
      const next = { ...current }
      let changed = false

      uploads.forEach((upload) => {
        if (next[upload.id]?.trim() === upload.originalName.trim()) {
          delete next[upload.id]
          changed = true
        }
      })

      if (!changed) return current
      persistFilenameOverrides(next)
      return next
    })
  }, [uploads])

  const loadDeleteRequests = React.useCallback(async () => {
    if (!admin) {
      setDeleteRequests([])
      return
    }

    setDeleteRequestsLoading(true)
    try {
      const response = await api.listDeleteRequests()
      setDeleteRequests(response.deleteRequests)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load deletion requests")
    } finally {
      setDeleteRequestsLoading(false)
    }
  }, [admin])

  React.useEffect(() => {
    void loadDeleteRequests()
  }, [loadDeleteRequests])

  const grouped = React.useMemo(() => {
    const groups = new Map<string, UploadRecord[]>()
    uploads.forEach((upload) => {
      const key = formatUploadGroup(upload.uploadedAt)
      groups.set(key, [...(groups.get(key) ?? []), upload])
    })
    return Array.from(groups.entries())
  }, [uploads])

  const pendingDeleteRequests = React.useMemo(
    () => deleteRequests.filter((request) => request.status === "pending"),
    [deleteRequests],
  )

  const openDetail = async (upload: UploadRecord, mode: DetailMode = "read") => {
    setDetail(null)
    setDetailMode(mode)
    setDetailLoading(true)
    setDetailOpen(true)
    try {
      const response = await api.getUpload(upload.id)
      setDetail({
        ...response,
        upload: {
          ...response.upload,
          originalName: getUploadFilename(response.upload),
        },
      })
    } catch (error) {
      setDetailOpen(false)
      toast.error(error instanceof Error ? error.message : "Load failed")
    } finally {
      setDetailLoading(false)
    }
  }

  const openMetadataEditor = (upload: UploadRecord) => {
    setEditTarget(upload)
    setEditFilename(getUploadFilename(upload))
    setEditCollege(upload.college)
  }

  const saveMetadata = async () => {
    if (!editTarget) return

    const targetID = editTarget.id
    const nextFilename = editFilename.trim()
    const nextCollege = editCollege.trim()

    setSavingMetadata(true)
    try {
      await api.updateUpload(targetID, {
        filename: nextFilename,
        college: nextCollege,
      })

      let refreshed: UploadDetail | null = null
      try {
        refreshed = await api.getUpload(targetID)
      } catch {
        // The list refresh below will retry the request.
      }

      if (refreshed?.upload.originalName.trim() === nextFilename) {
        setFilenameOverride(targetID)
      } else {
        setFilenameOverride(targetID, nextFilename)
      }

      if (detail?.upload.id === targetID) {
        setDetail(
          refreshed
            ? {
                ...refreshed,
                upload: {
                  ...refreshed.upload,
                  originalName: nextFilename,
                  college: nextCollege,
                },
              }
            : {
                ...detail,
                upload: {
                  ...detail.upload,
                  originalName: nextFilename,
                  college: nextCollege,
                },
              },
        )
      }

      toast.success("Repository metadata updated")
      setMetadataConfirmation(null)
      setEditTarget(null)
      await onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed")
    } finally {
      setSavingMetadata(false)
    }
  }

  const hasMetadataChanges = Boolean(
    editTarget &&
      (editFilename.trim() !== getUploadFilename(editTarget).trim() ||
        editCollege.trim() !== editTarget.college.trim()),
  )

  const closeMetadataEditor = () => {
    setMetadataConfirmation(null)
    setEditTarget(null)
    setEditFilename("")
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

  const downloadUpload = async (upload: UploadRecord) => {
    setDownloadingID(upload.id)
    try {
      const blob = await api.downloadUpload(upload.id)
      const objectURL = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectURL
      anchor.download = getUploadFilename(upload)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectURL), 0)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed")
    } finally {
      setDownloadingID(null)
    }
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

  const openDeleteRequest = (upload: UploadRecord) => {
    if (upload.deletionRequested) return
    setDeleteRequestTarget(upload)
    setDeleteReason("")
  }

  const submitDeleteRequest = async () => {
    if (!deleteRequestTarget) return

    const reason = deleteReason.trim()
    if (!reason) {
      toast.error("Please provide a reason for deletion")
      return
    }

    setSubmittingDeleteRequest(true)
    try {
      await api.requestUploadDeletion(deleteRequestTarget.id, reason)
      toast.success("Deletion request submitted for admin review")
      setDeleteRequestTarget(null)
      setDeleteReason("")
      await onChanged()
      if (admin) await loadDeleteRequests()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deletion request failed")
    } finally {
      setSubmittingDeleteRequest(false)
    }
  }

  const deleteUploadAsAdmin = async () => {
    if (!adminDeleteTarget) return

    const target = adminDeleteTarget
    setDeletingAdminUploadID(target.id)
    try {
      await api.deleteUpload(target.id)
      toast.success("Repository data deleted")
      if (detail?.upload.id === target.id) {
        setDetail(null)
        setDetailOpen(false)
      }
      setFilenameOverride(target.id)
      setAdminDeleteTarget(null)
      await onChanged()
      await loadDeleteRequests()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    } finally {
      setDeletingAdminUploadID(null)
    }
  }

  const rejectDeleteRequest = async () => {
    if (!reviewRequest) return

    setRejectingRequestID(reviewRequest.id)
    try {
      await api.rejectDeleteRequest(reviewRequest.id)
      toast.success("Deletion request rejected. The attendance file was kept.")
      setReviewRequest(null)
      await onChanged()
      await loadDeleteRequests()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reject deletion request")
    } finally {
      setRejectingRequestID(null)
    }
  }

  const preparePermanentDelete = () => {
    if (!reviewRequest) return
    setDeleteApprovalTarget(reviewRequest)
    setReviewRequest(null)
  }

  const approveDeleteRequest = async () => {
    if (!deleteApprovalTarget) return

    const target = deleteApprovalTarget
    setDeletingRequestID(target.id)
    try {
      await api.approveDeleteRequest(target.id)
      toast.success("Repository data deleted")
      if (detail?.upload.id === target.uploadId) {
        setDetail(null)
        setDetailOpen(false)
      }
      setFilenameOverride(target.uploadId)
      setDeleteApprovalTarget(null)
      await onChanged()
      await loadDeleteRequests()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    } finally {
      setDeletingRequestID(null)
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-48 place-items-center rounded-xl border bg-card">
        <LoaderCircle className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-8">
        {admin ? (
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Deletion requests</h3>
                    <p className="text-sm text-muted-foreground">Review the reason before deciding whether to keep or permanently delete a file.</p>
                  </div>
                </div>
                <Badge variant="secondary">{pendingDeleteRequests.length} pending</Badge>
              </div>

              <div className="mt-5 space-y-3">
                {deleteRequestsLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
                    <LoaderCircle className="h-4 w-4 animate-spin" /> Loading deletion requests...
                  </div>
                ) : pendingDeleteRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No pending deletion requests.
                  </div>
                ) : (
                  pendingDeleteRequests.map((request) => (
                    <div key={request.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium" title={request.originalName}>{request.originalName}</p>
                            <Badge variant="outline">Pending review</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {request.college} · Uploaded {formatDateTime(request.uploadedAt)} · Requested {formatDateTime(request.requestedAt)}
                          </p>
                          <p className="mt-3 whitespace-pre-wrap text-sm">
                            <span className="font-medium">Reason:</span> {request.reason}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setReviewRequest(request)}>
                          Review
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {uploads.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/70 p-12 text-center">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold">No saved attendance data</h3>
            <p className="mt-2 text-sm text-muted-foreground">Imported workbook rows will appear here.</p>
          </div>
        ) : (
          grouped.map(([date, records]) => (
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
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold" title={getUploadFilename(upload)}>
                              {getUploadFilename(upload)}
                            </p>
                            {upload.deletionRequested ? <Badge variant="secondary">Deletion requested</Badge> : null}
                          </div>
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
                              aria-label={`Preview and download ${getUploadFilename(upload)}`}
                              onClick={() => void openDetail(upload, "download")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                        {admin ? (
                          <Button variant="destructive" size="sm" onClick={() => setAdminDeleteTarget(upload)}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
                        ) : upload.deletionRequested ? (
                          <Button variant="outline" size="sm" disabled>
                            <ClipboardList className="h-4 w-4" /> Deletion requested
                          </Button>
                        ) : (
                          <Button variant="destructive" size="sm" onClick={() => openDeleteRequest(upload)}>
                            <Trash2 className="h-4 w-4" /> Request Delete
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
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
          title={
            detailMode === "download"
              ? `Download preview: ${getUploadFilename(detail.upload)}`
              : getUploadFilename(detail.upload)
          }
          description={`${detail.upload.college} · Uploaded ${formatDateTime(detail.upload.uploadedAt)}`}
          sheets={detail.sheets}
          editable={admin && detailMode === "read"}
          saving={savingWorkbook}
          onSave={saveWorkbook}
          footer={detailMode === "download" && admin ? (
            <Button
              onClick={() => void downloadUpload(detail.upload)}
              disabled={downloadingID === detail.upload.id}
            >
              {downloadingID === detail.upload.id ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download .xlsx
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
              <Label htmlFor="edit-filename">Filename</Label>
              <Input
                id="edit-filename"
                value={editFilename}
                onChange={(event) => setEditFilename(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-college">College</Label>
              <Input id="edit-college" value={editCollege} onChange={(event) => setEditCollege(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={requestCloseMetadataEditor} disabled={savingMetadata}>Cancel</Button>
            <Button
              onClick={() => setMetadataConfirmation("save")}
              disabled={savingMetadata || !editFilename.trim() || !editCollege.trim() || !hasMetadataChanges}
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
                ? `This will update ${editTarget ? getUploadFilename(editTarget) : "the file"} to ${editFilename.trim()} under ${editCollege.trim()}.`
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
        open={Boolean(adminDeleteTarget)}
        onOpenChange={(open) => {
          if (!open && deletingAdminUploadID === null) setAdminDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete attendance data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {adminDeleteTarget ? getUploadFilename(adminDeleteTarget) : "this attendance file"}, including its workbook sheets and imported attendance rows. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {adminDeleteTarget?.deletionRequested ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              This file also has a pending deletion request. Deleting it now will complete that pending request automatically.
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAdminUploadID !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void deleteUploadAsAdmin()
              }}
              disabled={deletingAdminUploadID !== null}
            >
              {deletingAdminUploadID !== null ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(deleteRequestTarget)}
        onOpenChange={(open) => {
          if (!open && !submittingDeleteRequest) {
            setDeleteRequestTarget(null)
            setDeleteReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request deletion</DialogTitle>
            <DialogDescription>
              Request deletion of {deleteRequestTarget ? getUploadFilename(deleteRequestTarget) : "this attendance file"}. An admin must review the reason before anything is deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="delete-reason">Reason for deletion</Label>
            <textarea
              id="delete-reason"
              className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Explain why this attendance file should be deleted."
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              disabled={submittingDeleteRequest}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteRequestTarget(null)
                setDeleteReason("")
              }}
              disabled={submittingDeleteRequest}
            >
              Cancel
            </Button>
            <Button onClick={() => void submitDeleteRequest()} disabled={submittingDeleteRequest || !deleteReason.trim()}>
              {submittingDeleteRequest ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reviewRequest)}
        onOpenChange={(open) => {
          if (!open && rejectingRequestID === null) setReviewRequest(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review deletion request</DialogTitle>
            <DialogDescription>
              {reviewRequest ? `${reviewRequest.originalName} · ${reviewRequest.college} · Requested ${formatDateTime(reviewRequest.requestedAt)}` : "Review the submitted deletion request."}
            </DialogDescription>
          </DialogHeader>
          {reviewRequest ? (
            <div className="space-y-3 py-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason for deletion</p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{reviewRequest.reason}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Rejecting keeps the workbook unchanged. Permanent deletion requires one more confirmation.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewRequest(null)} disabled={rejectingRequestID !== null}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => void rejectDeleteRequest()} disabled={rejectingRequestID !== null}>
              {rejectingRequestID !== null ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Keep File
            </Button>
            <Button variant="destructive" onClick={preparePermanentDelete} disabled={rejectingRequestID !== null}>
              <Trash2 className="h-4 w-4" /> Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteApprovalTarget)}
        onOpenChange={(open) => {
          if (!open && deletingRequestID === null) setDeleteApprovalTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete attendance data?</AlertDialogTitle>
            <AlertDialogDescription>
              You reviewed the deletion request for {deleteApprovalTarget?.originalName ?? "this file"}. This permanently removes the workbook, sheets, and imported attendance rows. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteApprovalTarget ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted reason</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{deleteApprovalTarget.reason}</p>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRequestID !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void approveDeleteRequest()
              }}
              disabled={deletingRequestID !== null}
            >
              {deletingRequestID !== null ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
