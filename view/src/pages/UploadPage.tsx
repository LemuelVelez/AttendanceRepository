import * as React from "react"
import { BookOpen, RefreshCw, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { AppHeader } from "@/components/AppHeader"
import { RepositoryList } from "@/components/RepositoryList"
import { UploadWizard } from "@/components/UploadWizard"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
import type { UploadRecord } from "@/lib/types"

export function UploadPage() {
  const { user } = useAuth()
  const [uploads, setUploads] = React.useState<UploadRecord[]>([])
  const [loading, setLoading] = React.useState(true)

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

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container space-y-10 py-8 lg:py-12">
        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <BookOpen className="h-4 w-4 text-primary" />
              Public read-only repository
            </div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Attendance workbooks, readable in one place.</h1>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Anyone can read imported attendance data. Administrative actions are protected by the single admin account.
            </p>
          </div>
          <div className="rounded-2xl border bg-card/80 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-3 text-primary"><ShieldCheck className="h-6 w-6" /></div>
              <div>
                <p className="font-semibold">{user ? "Admin access active" : "Read-only access"}</p>
                <p className="text-sm text-muted-foreground">{user ? "CRUD and download are enabled." : "Login is required to change files."}</p>
              </div>
            </div>
          </div>
        </section>

        {user ? <UploadWizard onSaved={refresh} /> : null}

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Uploaded workbooks</h2>
              <p className="mt-1 text-sm text-muted-foreground">Grouped by actual server upload date and time.</p>
            </div>
            <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
          </div>
          <RepositoryList uploads={uploads} admin={Boolean(user)} loading={loading} onChanged={refresh} />
        </section>
      </main>
    </div>
  )
}
