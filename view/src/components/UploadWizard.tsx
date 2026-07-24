import * as React from "react"
import { ArrowLeft, ArrowRight, FileSpreadsheet, LoaderCircle, RotateCcw, Save, UploadCloud } from "lucide-react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import { readXlsx } from "@/lib/excel"
import type { PreviewRecord } from "@/lib/types"
import { cn, formatBytes } from "@/lib/utils"

const colleges = [
  "College of Business Administration",
  "College of Teacher Education",
  "College of Computing Studies",
  "College of Agriculture and Forestry",
  "College of Liberal Arts, Mathematics and Sciences",
  "School of Engineering",
  "School of Criminal Justice Education",
  "Custom college",
]

const uploadSteps = ["College", "Workbook"]

type UploadConfirmation = "save-preview" | "discard-preview" | "reset" | "replace-preview" | null

type UploadWizardProps = {
  onSaved: () => Promise<void> | void
}

export function UploadWizard({ onSaved }: UploadWizardProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [step, setStep] = React.useState(0)
  const [collegeOption, setCollegeOption] = React.useState("")
  const [customCollege, setCustomCollege] = React.useState("")
  const [dragging, setDragging] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [processing, setProcessing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [preview, setPreview] = React.useState<PreviewRecord | null>(null)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [confirmation, setConfirmation] = React.useState<UploadConfirmation>(null)
  const [confirming, setConfirming] = React.useState(false)
  const [pendingReplacementFile, setPendingReplacementFile] = React.useState<File | null>(null)

  const college = collegeOption === "Custom college" ? customCollege.trim() : collegeOption

  const resetWizard = React.useCallback(() => {
    setStep(0)
    setCollegeOption("")
    setCustomCollege("")
    setSelectedFile(null)
    setPreview(null)
    setPreviewOpen(false)
    setConfirmation(null)
    setPendingReplacementFile(null)
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  const selectFile = (file: File) => {
    setSelectedFile(file)
    setPreview(null)
    setPreviewOpen(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  const chooseFile = (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Only .xlsx files are accepted")
      return
    }

    if (preview) {
      setPendingReplacementFile(file)
      setConfirmation("replace-preview")
      return
    }

    selectFile(file)
  }

  const uploadFile = async () => {
    if (!selectedFile) return

    setProcessing(true)
    try {
      const localSheets = await readXlsx(selectedFile)
      const localRows = localSheets.reduce((total, sheet) => total + sheet.rows.length, 0)
      if (localRows === 0) throw new Error("The workbook does not contain any data rows")

      const form = new FormData()
      form.append("file", selectedFile)
      form.append("college", college)
      const response = await api.previewUpload(form)
      setPreview(response.preview)
      setSelectedFile(null)
      setPreviewOpen(true)
      toast.success(`Read ${response.preview.rowCount} rows from ${response.preview.sheetCount} sheet(s)`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload workbook")
    } finally {
      setProcessing(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const savePreview = async () => {
    if (!preview) return
    setSaving(true)
    try {
      await api.savePreview(preview.id)
      toast.success("Workbook data saved to the database")
      await onSaved()
      resetWizard()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const discardPreview = async () => {
    if (!preview) return
    try {
      await api.discardPreview(preview.id)
    } catch {
      // The preview may already have expired; local cleanup is still safe.
    }
    setPreview(null)
    setPreviewOpen(false)
  }

  const confirmUploadAction = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()

    if (confirmation === "save-preview") {
      await savePreview()
      return
    }

    setConfirming(true)
    try {
      if (confirmation === "replace-preview") {
        const replacementFile = pendingReplacementFile
        await discardPreview()
        if (replacementFile) selectFile(replacementFile)
      } else if (confirmation === "discard-preview") {
        await discardPreview()
      } else if (confirmation === "reset") {
        await discardPreview()
        resetWizard()
      }
      setPendingReplacementFile(null)
      setConfirmation(null)
    } finally {
      setConfirming(false)
    }
  }

  const confirmationTitle =
    confirmation === "save-preview"
      ? "Save workbook to the database?"
      : confirmation === "discard-preview"
        ? "Discard workbook preview?"
        : confirmation === "replace-preview"
          ? "Replace workbook preview?"
          : "Start over?"

  const confirmationDescription =
    confirmation === "save-preview"
      ? `This will import ${preview?.rowCount ?? 0} rows from ${preview?.originalName ?? "this workbook"}.`
      : confirmation === "discard-preview"
        ? "The uploaded preview will be removed without saving it to the database."
        : confirmation === "replace-preview"
          ? `The current preview will be discarded and replaced with ${pendingReplacementFile?.name ?? "the selected file"}.`
          : "The selected college, file, and unsaved preview will be cleared."

  const confirmationLabel =
    confirmation === "save-preview"
      ? "Save to database"
      : confirmation === "discard-preview"
        ? "Discard preview"
        : confirmation === "replace-preview"
          ? "Replace preview"
          : "Start over"

  const confirmationPending = saving || confirming

  return (
    <>
      <Card className="overflow-hidden border-primary/20 shadow-md">
        <CardHeader className="space-y-4 bg-gradient-to-r from-primary via-blue-700 to-accent p-4 text-primary-foreground sm:p-6">
        <div>
          <CardTitle className="text-xl leading-tight sm:text-2xl">Upload attendance workbook</CardTitle>
        </div>

        <div className="rounded-xl bg-white/10 p-3" aria-label={`Upload progress: ${step + 1} of ${uploadSteps.length}`}>
          <div className="flex items-center justify-between gap-3 text-xs font-medium sm:text-sm">
            <span className="min-w-0 truncate">{uploadSteps[step]}</span>
            <span className="shrink-0 tabular-nums">{step + 1}/{uploadSteps.length}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5" aria-hidden="true">
            {uploadSteps.map((label, index) => (
              <div
                key={label}
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  index <= step ? "bg-white" : "bg-white/25",
                )}
              />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-center text-[10px] leading-tight text-primary-foreground/75 sm:text-xs">
            {uploadSteps.map((label, index) => (
              <span key={label} className={cn("truncate", index === step && "font-semibold text-white")}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {step === 0 ? (
          <div className="mx-auto max-w-xl space-y-5">
            <div className="space-y-2">
              <Label>College</Label>
              <Select value={collegeOption} onValueChange={setCollegeOption}>
                <SelectTrigger className="min-w-0">
                  <SelectValue placeholder="Select a college" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  {colleges.map((item) => (
                    <SelectItem key={item} value={item} className="whitespace-normal py-2.5 leading-snug">
                      <span className="block break-words">{item}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {collegeOption === "Custom college" ? (
              <div className="space-y-2">
                <Label htmlFor="custom-college">Custom college</Label>
                <Input id="custom-college" value={customCollege} onChange={(event) => setCustomCollege(event.target.value)} placeholder="Enter college name" />
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button className="w-full sm:w-auto" onClick={() => setStep(1)} disabled={!college}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{college}</Badge>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <button
              type="button"
              className={cn(
                "flex min-h-52 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition sm:min-h-64 sm:p-8",
                dragging ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/60 hover:bg-muted/40",
              )}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { event.preventDefault(); setDragging(false) }}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                chooseFile(event.dataTransfer.files?.[0])
              }}
              onClick={() => inputRef.current?.click()}
              disabled={processing}
            >
              {selectedFile ? <FileSpreadsheet className="mb-4 h-12 w-12 text-primary" /> : <UploadCloud className="mb-4 h-12 w-12 text-primary" />}
              <span className="max-w-full break-words text-base font-semibold sm:text-lg">
                {selectedFile ? selectedFile.name : "Drop an .xlsx file here or click to choose"}
              </span>
            </button>

            {selectedFile ? (
              <div className="flex justify-end">
                <Button className="w-full sm:w-auto" onClick={() => void uploadFile()} disabled={processing}>
                  {processing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {processing ? "Uploading…" : "Upload workbook"}
                </Button>
              </div>
            ) : null}

            {preview ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{preview.originalName}</p>
                    <p className="text-xs text-muted-foreground">{preview.rowCount} rows · {preview.sheetCount} sheets · {formatBytes(preview.sizeBytes)}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setPreviewOpen(true)}>Review data</Button>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button variant="outline" onClick={() => setStep(0)} disabled={processing}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button variant="ghost" onClick={() => setConfirmation("reset")} disabled={processing}><RotateCcw className="h-4 w-4" /> Start over</Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      {preview ? (
        <WorkbookDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={`Preview: ${preview.originalName}`}
          description={`${preview.college} · ${preview.rowCount} data rows`}
          sheets={preview.sheets}
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmation("discard-preview")} disabled={saving}>Discard</Button>
              <Button onClick={() => setConfirmation("save-preview")} disabled={saving}>
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save to database
              </Button>
            </>
          }
        />
      ) : null}
      </Card>

      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !confirmationPending) {
            setConfirmation(null)
            setPendingReplacementFile(null)
            if (inputRef.current) inputRef.current.value = ""
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmationDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmationPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmation === "save-preview"
                  ? undefined
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
              onClick={confirmUploadAction}
              disabled={confirmationPending}
            >
              {confirmationPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : confirmation === "save-preview" ? (
                <Save className="h-4 w-4" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {confirmationLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
