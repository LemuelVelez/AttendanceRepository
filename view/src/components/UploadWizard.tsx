import * as React from "react"
import { ArrowLeft, ArrowRight, FileSpreadsheet, LoaderCircle, RotateCcw, Save, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { WorkbookDialog } from "@/components/WorkbookDialog"
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
  "College of Arts and Sciences",
  "College of Business and Accountancy",
  "College of Computer Studies",
  "College of Education",
  "College of Engineering",
  "College of Hospitality Management",
  "College of Nursing",
  "Custom college",
]

function manilaDateTime() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` }
}

type UploadWizardProps = {
  onSaved: () => Promise<void> | void
}

export function UploadWizard({ onSaved }: UploadWizardProps) {
  const now = React.useMemo(manilaDateTime, [])
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [step, setStep] = React.useState(0)
  const [collegeOption, setCollegeOption] = React.useState("")
  const [customCollege, setCustomCollege] = React.useState("")
  const [eventDate, setEventDate] = React.useState(now.date)
  const [eventTime, setEventTime] = React.useState(now.time)
  const [dragging, setDragging] = React.useState(false)
  const [processing, setProcessing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [preview, setPreview] = React.useState<PreviewRecord | null>(null)
  const [previewOpen, setPreviewOpen] = React.useState(false)

  const college = collegeOption === "Custom college" ? customCollege.trim() : collegeOption

  const reset = React.useCallback(() => {
    const nextNow = manilaDateTime()
    setStep(0)
    setCollegeOption("")
    setCustomCollege("")
    setEventDate(nextNow.date)
    setEventTime(nextNow.time)
    setPreview(null)
    setPreviewOpen(false)
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  const processFile = async (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Only .xlsx files are accepted")
      return
    }

    setProcessing(true)
    try {
      const localSheets = await readXlsx(file)
      const localRows = localSheets.reduce((total, sheet) => total + sheet.rows.length, 0)
      if (localRows === 0) throw new Error("The workbook does not contain any data rows")

      const form = new FormData()
      form.append("file", file)
      form.append("college", college)
      form.append("eventDate", eventDate)
      form.append("eventTime", eventTime)
      const response = await api.previewUpload(form)
      setPreview(response.preview)
      setPreviewOpen(true)
      toast.success(`Read ${response.preview.rowCount} rows from ${response.preview.sheetCount} sheet(s)`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to read workbook")
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
      reset()
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

  return (
    <Card className="overflow-hidden border-primary/20 shadow-md">
      <CardHeader className="bg-gradient-to-r from-primary to-amber-800 text-primary-foreground">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Upload attendance workbook</CardTitle>
            <CardDescription className="mt-2 text-primary-foreground/80">
              The workbook is read for preview, then only parsed rows are saved to the database.
            </CardDescription>
          </div>
          <Badge variant="secondary">Step {step + 1} of 3</Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {step === 0 ? (
          <div className="mx-auto max-w-xl space-y-5">
            <div className="space-y-2">
              <Label>College</Label>
              <Select value={collegeOption} onValueChange={setCollegeOption}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a college" />
                </SelectTrigger>
                <SelectContent>
                  {colleges.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
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
              <Button onClick={() => setStep(1)} disabled={!college}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mx-auto max-w-xl space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-date">Event date</Label>
                <Input id="event-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-time">Event time</Label>
                <Input id="event-time" type="time" value={eventTime} onChange={(event) => setEventTime(event.target.value)} />
              </div>
            </div>
            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={() => setStep(2)} disabled={!eventDate || !eventTime}>Continue <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{college}</Badge>
              <Badge variant="outline">{eventDate}</Badge>
              <Badge variant="outline">{eventTime}</Badge>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => void processFile(event.target.files?.[0])}
            />
            <button
              type="button"
              className={cn(
                "flex min-h-64 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition",
                dragging ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/60 hover:bg-muted/40",
              )}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { event.preventDefault(); setDragging(false) }}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                void processFile(event.dataTransfer.files?.[0])
              }}
              onClick={() => inputRef.current?.click()}
              disabled={processing}
            >
              {processing ? <LoaderCircle className="mb-4 h-12 w-12 animate-spin text-primary" /> : <UploadCloud className="mb-4 h-12 w-12 text-primary" />}
              <span className="text-lg font-semibold">{processing ? "Reading workbook…" : "Drop an .xlsx file here"}</span>
              <span className="mt-2 text-sm text-muted-foreground">or click to choose a file</span>
            </button>

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

            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(1)} disabled={processing}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button variant="ghost" onClick={reset} disabled={processing}><RotateCcw className="h-4 w-4" /> Start over</Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      {preview ? (
        <WorkbookDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={`Preview: ${preview.originalName}`}
          description={`${preview.college} · ${preview.eventDate} ${preview.eventTime} · ${preview.rowCount} data rows`}
          sheets={preview.sheets}
          footer={
            <>
              <Button variant="outline" onClick={() => void discardPreview()} disabled={saving}>Discard</Button>
              <Button onClick={() => void savePreview()} disabled={saving}>
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save to database
              </Button>
            </>
          }
        />
      ) : null}
    </Card>
  )
}
