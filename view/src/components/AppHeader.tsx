import * as React from "react"
import { LoaderCircle, LogIn, LogOut, ShieldCheck } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import logo from "@/assets/images/logo.png"
import { CreateAdminDialog } from "@/components/CreateAdminDialog"
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
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"

export function AppHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [logoutOpen, setLogoutOpen] = React.useState(false)
  const [loggingOut, setLoggingOut] = React.useState(false)

  const handleLogout = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setLoggingOut(true)
    try {
      await logout()
      setLogoutOpen(false)
      toast.success("Signed out")
      navigate("/")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign out failed")
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <>
      <header className="border-b bg-background/90 backdrop-blur">
        <div className="container flex min-h-16 items-center justify-between gap-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Attendance Repository logo" className="h-10 w-10 shrink-0 rounded-xl object-contain" />
            <p className="truncate text-lg font-bold tracking-tight">Attendance Repository</p>
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              <CreateAdminDialog />
              <div className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium sm:flex">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {user.email}
              </div>
              <Button variant="outline" size="sm" onClick={() => setLogoutOpen(true)}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          ) : (
            <Button asChild size="sm">
              <Link to="/login" aria-label="Admin login" title="Admin login">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Admin login</span>
              </Link>
            </Button>
          )}
        </div>
      </header>

      <AlertDialog
        open={logoutOpen}
        onOpenChange={(nextOpen) => {
          if (!loggingOut) setLogoutOpen(nextOpen)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>You will need to sign in again to access administrator actions.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
