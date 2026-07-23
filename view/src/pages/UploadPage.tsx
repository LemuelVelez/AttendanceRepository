import * as React from "react"
import { RefreshCw } from "lucide-react"
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
        <section>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Attendance workbooks, readable in one place.
          </h1>
        </section>

        {user ? <UploadWizard onSaved={refresh} /> : null}

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight">Uploaded workbooks</h2>
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
