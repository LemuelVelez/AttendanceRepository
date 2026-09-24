import * as React from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { AppHeader } from "@/components/AppHeader"
import { RepositoryList } from "@/components/RepositoryList"
import { UploadWizard } from "@/components/UploadWizard"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
import type { UploadRecord } from "@/lib/types"

export function UploadPage() {
  const { user } = useAuth()
  const [uploads, setUploads] = React.useState<UploadRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [collegeFilter, setCollegeFilter] = React.useState("all")

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.listUploads()
      setUploads(response.uploads)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load repository")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const colleges = React.useMemo(
    () => Array.from(new Set(uploads.map((upload) => upload.college).filter(Boolean))).sort(),
    [uploads],
  )

  const filteredUploads = React.useMemo(
    () => (collegeFilter === "all" ? uploads : uploads.filter((upload) => upload.college === collegeFilter)),
    [collegeFilter, uploads],
  )

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container min-w-0 space-y-10 py-8 lg:py-12">
        <section>
          <h1 className="max-w-3xl break-words text-3xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
            Attendance workbooks, readable in one place.
          </h1>
        </section>

        <UploadWizard onSaved={refresh} />

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 w-full flex-wrap items-center gap-3 sm:w-auto">
              <h2 className="text-2xl font-bold tracking-tight">Uploaded workbooks</h2>
              <Select value={collegeFilter} onValueChange={setCollegeFilter}>
                <SelectTrigger className="min-w-0 w-full max-w-full sm:w-72">
                  <SelectValue placeholder="Filter by College" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  <SelectItem value="all" className="whitespace-normal break-words [overflow-wrap:anywhere]">All colleges</SelectItem>
                  {colleges.map((college) => (
                    <SelectItem key={college} value={college} className="whitespace-normal break-words [overflow-wrap:anywhere]">
                      {college}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
          </div>
          <RepositoryList uploads={filteredUploads} admin={user?.role === "admin"} loading={loading} onChanged={refresh} />
        </section>
      </main>
    </div>
  )
}
