import { LogIn, LogOut, ShieldCheck } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"

export function AppHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      toast.success("Signed out")
      navigate("/")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign out failed")
    }
  }

  return (
    <header className="border-b bg-background/90 backdrop-blur">
      <div className="container flex min-h-16 items-center justify-between gap-4 py-3">
        <Link to="/" className="min-w-0">
          <p className="truncate text-lg font-bold tracking-tight">Attendance Repository</p>
          <p className="hidden text-xs text-muted-foreground sm:block">Excel attendance archive and data preview</p>
        </Link>

        {user ? (
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium sm:flex">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {user.email}
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        ) : (
          <Button asChild size="sm">
            <Link to="/login">
              <LogIn className="h-4 w-4" />
              Admin login
            </Link>
          </Button>
        )}
      </div>
    </header>
  )
}
