import * as React from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FolderOpen,
  LoaderCircle,
  RotateCcw,
  Save,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { WorkbookDialog } from "@/components/WorkbookDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { readXlsx } from "@/lib/excel";
import type { PreviewRecord } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";

const colleges = [
  "College of Arts and Sciences",
  "College of Business and Accountancy",
  "College of Computer Studies",
  "College of Education",
  "College of Engineering",
  "College of Hospitality Management",
  "College of Nursing",
  "Custom college",
];

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function manilaDateTime() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    time: `${value.hour}:${value.minute}`,
  };
}

type UploadWizardProps = {
  onSaved: () => Promise<void> | void;
};

export function UploadWizard({ onSaved }: UploadWizardProps) {
  const now = React.useMemo(manilaDateTime, []);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dragDepthRef = React.useRef(0);
  const uploadAbortRef = React.useRef<AbortController | null>(null);
  const [step, setStep] = React.useState(0);
  const [collegeOption, setCollegeOption] = React.useState("");
  const [customCollege, setCustomCollege] = React.useState("");
  const [eventDate, setEventDate] = React.useState(now.date);
  const [eventTime, setEventTime] = React.useState(now.time);
  const [dragging, setDragging] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [processingStage, setProcessingStage] = React.useState<
    "reading" | "uploading"
  >("reading");
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadError, setUploadError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewRecord | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const college =
    collegeOption === "Custom college" ? customCollege.trim() : collegeOption;
  const busy = processing || saving;

  React.useEffect(() => () => uploadAbortRef.current?.abort(), []);

  const reset = React.useCallback(() => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    const nextNow = manilaDateTime();
    setStep(0);
    setCollegeOption("");
    setCustomCollege("");
    setEventDate(nextNow.date);
    setEventTime(nextNow.time);
    setSelectedFile(null);
    setDragging(false);
    setProcessing(false);
    setProcessingStage("reading");
    setUploadProgress(0);
    setUploadError("");
    setPreview(null);
    setPreviewOpen(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const chooseFile = (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Only .xlsx files are accepted");
      return;
    }
    if (file.size <= 0) {
      toast.error("The selected workbook is empty");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(
        `The workbook must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller`,
      );
      return;
    }

    if (preview) {
      void api.discardPreview(preview.id).catch(() => undefined);
    }

    setSelectedFile(file);
    setUploadProgress(0);
    setUploadError("");
    setPreview(null);
    setPreviewOpen(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const clearSelectedFile = () => {
    if (processing) return;
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const openFilePicker = () => {
    if (!busy) inputRef.current?.click();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    dragDepthRef.current += 1;
    setDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setDragging(false);
    if (busy) return;

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 1) {
      toast.error("Upload one workbook at a time");
      return;
    }
    chooseFile(files[0]);
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setProcessing(true);
    setProcessingStage("reading");
    setUploadProgress(0);
    setUploadError("");
    try {
      const localSheets = await readXlsx(selectedFile);
      const localRows = localSheets.reduce(
        (total, sheet) => total + sheet.rows.length,
        0,
      );
      if (localRows === 0)
        throw new Error("The workbook does not contain any data rows");

      setProcessingStage("uploading");
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("college", college);
      form.append("eventDate", eventDate);
      form.append("eventTime", eventTime);
      const response = await api.previewUpload(form, {
        signal: controller.signal,
        onProgress: setUploadProgress,
      });
      setPreview(response.preview);
      setSelectedFile(null);
      setUploadProgress(100);
      setPreviewOpen(true);
      toast.success(
        `Read ${response.preview.rowCount} rows from ${response.preview.sheetCount} sheet(s)`,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setUploadError("");
        toast.info("Upload cancelled");
      } else {
        const message =
          error instanceof Error ? error.message : "Unable to upload workbook";
        setUploadError(message);
        toast.error(message);
      }
    } finally {
      uploadAbortRef.current = null;
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const cancelUpload = () => uploadAbortRef.current?.abort();

  const savePreview = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      await api.savePreview(preview.id);
      toast.success("Workbook data saved to the database");
      await onSaved();
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const discardPreview = async () => {
    if (!preview) return;
    try {
      await api.discardPreview(preview.id);
    } catch {
      // The preview may already have expired; local cleanup is still safe.
    }
    setPreview(null);
    setPreviewOpen(false);
  };

  return (
    <Card className="overflow-hidden border-primary/20 shadow-md">
      <CardHeader className="bg-gradient-to-r from-primary via-blue-700 to-accent text-primary-foreground">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Upload attendance workbook</CardTitle>
            <CardDescription className="mt-2 text-primary-foreground/80">
              The workbook is read for preview, then only parsed rows are saved
              to the database.
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
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {collegeOption === "Custom college" ? (
              <div className="space-y-2">
                <Label htmlFor="custom-college">Custom college</Label>
                <Input
                  id="custom-college"
                  value={customCollege}
                  onChange={(event) => setCustomCollege(event.target.value)}
                  placeholder="Enter college name"
                />
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
                <Input
                  id="event-date"
                  type="date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-time">Event time</Label>
                <Input
                  id="event-time"
                  type="time"
                  value={eventTime}
                  onChange={(event) => setEventTime(event.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!eventDate || !eventTime}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
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
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <div
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-disabled={busy}
              aria-label="Choose an Excel attendance workbook to upload"
              className={cn(
                "group flex min-h-64 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center outline-none transition-all",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                dragging
                  ? "scale-[1.01] border-primary bg-primary/10 shadow-inner"
                  : "border-border bg-muted/20 hover:border-primary/60 hover:bg-muted/40",
                busy && "cursor-not-allowed opacity-60",
              )}
              onDragEnter={handleDragEnter}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={openFilePicker}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openFilePicker();
                }
              }}
            >
              <div className="mb-5 rounded-2xl bg-primary/10 p-4 text-primary transition-transform group-hover:-translate-y-1">
                {dragging ? (
                  <FolderOpen className="h-10 w-10" />
                ) : (
                  <UploadCloud className="h-10 w-10" />
                )}
              </div>
              <p className="text-lg font-semibold">
                {dragging
                  ? "Drop your workbook here"
                  : selectedFile
                    ? "Drop or click to replace the workbook"
                    : "Drag and drop your workbook here"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                or{" "}
                <span className="font-semibold text-primary underline underline-offset-4">
                  click to browse
                </span>
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                Excel .xlsx only · Maximum {formatBytes(MAX_UPLOAD_BYTES)}
              </p>
            </div>

            {selectedFile ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <FileSpreadsheet className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(selectedFile.size)} · Ready to upload
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={clearSelectedFile}
                    disabled={processing}
                    aria-label="Remove selected workbook"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {processing ? (
                  <div
                    className="space-y-3 rounded-xl border bg-muted/20 p-4"
                    aria-live="polite"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                        {processingStage === "reading"
                          ? "Reading workbook…"
                          : "Uploading workbook…"}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {processingStage === "reading"
                          ? "Preparing"
                          : `${uploadProgress}%`}
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label="Workbook upload progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={
                        processingStage === "reading"
                          ? undefined
                          : uploadProgress
                      }
                    >
                      <div
                        className={cn(
                          "h-full rounded-full bg-primary transition-all",
                          processingStage === "reading" &&
                            "w-1/3 animate-pulse",
                        )}
                        style={
                          processingStage === "uploading"
                            ? { width: `${uploadProgress}%` }
                            : undefined
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {uploadError ? (
                  <div
                    className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                    role="alert"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{uploadError}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-3">
                  {processing ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelUpload}
                    >
                      Cancel upload
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openFilePicker}
                      >
                        <FolderOpen className="h-4 w-4" /> Replace file
                      </Button>
                      <Button onClick={() => void uploadFile()}>
                        <UploadCloud className="h-4 w-4" /> Upload workbook
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {preview ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {preview.originalName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {preview.rowCount} rows · {preview.sheetCount} sheets ·{" "}
                      {formatBytes(preview.sizeBytes)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2
                    className="h-5 w-5 text-emerald-600"
                    aria-hidden="true"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setPreviewOpen(true)}
                  >
                    Review data
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={busy}
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button variant="ghost" onClick={reset} disabled={saving}>
                <RotateCcw className="h-4 w-4" /> Start over
              </Button>
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
              <Button
                variant="outline"
                onClick={() => void discardPreview()}
                disabled={saving}
              >
                Discard
              </Button>
              <Button onClick={() => void savePreview()} disabled={saving}>
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save to database
              </Button>
            </>
          }
        />
      ) : null}
    </Card>
  );
}
