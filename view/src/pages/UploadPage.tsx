import * as React from "react"
import { RefreshCw, Search, X } from "lucide-react"
import { toast } from "sonner"

import { AppHeader } from "@/components/AppHeader"
import { RepositoryList } from "@/components/RepositoryList"
import { UploadWizard } from "@/components/UploadWizard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
import type { UploadRecord } from "@/lib/types"

export function UploadPage() {
  const { user } = useAuth()
  const [uploads, setUploads] = React.useState<UploadRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [collegeFilter, setCollegeFilter] = React.useState("all")
  const [eventSearch, setEventSearch] = React.useState("")

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

  const searchTerms = React.useMemo(
    () => eventSearch.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),
    [eventSearch],
  )
  const hasActiveFilters = collegeFilter !== "all" || searchTerms.length > 0

  const filteredUploads = React.useMemo(
    () => uploads.filter((upload) => {
      if (collegeFilter !== "all" && upload.college !== collegeFilter) return false
      const searchableText = [upload.originalName, upload.college, upload.representativeName]
        .join(" ")
        .toLocaleLowerCase()
      return searchTerms.every((term) => searchableText.includes(term))
    }),
    [collegeFilter, uploads, searchTerms],
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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight">Uploaded workbooks</h2>
            <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-md sm:flex-1">
              <label htmlFor="event-search" className="sr-only">Search uploaded events</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="event-search"
                type="search"
                value={eventSearch}
                onChange={(event) => setEventSearch(event.target.value)}
                placeholder="Search uploaded events..."
                className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
              />
              {eventSearch ? (
                <button
                  type="button"
                  onClick={() => setEventSearch("")}
                  aria-label="Clear event search"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <Select value={collegeFilter} onValueChange={setCollegeFilter}>
              <SelectTrigger className="w-full sm:w-72">
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
          {hasActiveFilters && !loading ? (
            <p className="text-sm text-muted-foreground" role="status">
              Showing {filteredUploads.length} of {uploads.length} uploaded events
            </p>
          ) : null}
          <RepositoryList
            uploads={filteredUploads}
            admin={user?.role === "admin"}
            loading={loading}
            onChanged={refresh}
            hasActiveFilters={hasActiveFilters}
          />
        </section>
      </main>
    </div>
  )
}
