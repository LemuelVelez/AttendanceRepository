import * as React from "react"
import { LoaderCircle, Pencil, Search, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PasswordInput } from "@/components/PasswordInput"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
import type { User } from "@/lib/types"

type AdminForm = {
  email: string
  password: string
  confirmPassword: string
}

type AdminConfirmation = "create" | "update" | "discard-edit" | null

const emptyForm: AdminForm = { email: "", password: "", confirmPassword: "" }

export function CreateAdminDialog() {
  const { user: currentUser, refresh } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [admins, setAdmins] = React.useState<User[]>([])
  const [loading, setLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [createForm, setCreateForm] = React.useState<AdminForm>(emptyForm)
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<User | null>(null)
  const [editForm, setEditForm] = React.useState<AdminForm>(emptyForm)
  const [updating, setUpdating] = React.useState(false)
  const [deleting, setDeleting] = React.useState<User | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)
  const [adminConfirmation, setAdminConfirmation] = React.useState<AdminConfirmation>(null)

  const loadAdmins = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.listAdmins()
      setAdmins(response.users)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load admins")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) void loadAdmins()
  }, [loadAdmins, open])

  const filteredAdmins = React.useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    if (!query) return admins

    return admins.filter((admin) =>
      [admin.email, String(admin.id)].some((value) => value.toLocaleLowerCase().includes(query)),
    )
  }, [admins, searchQuery])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setSearchQuery("")
  }

  const updateCreateForm = (field: keyof AdminForm, value: string) => {
    setCreateForm((current) => ({ ...current, [field]: value }))
  }

  const updateEditForm = (field: keyof AdminForm, value: string) => {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  const validatePasswords = (form: AdminForm, passwordRequired: boolean) => {
    if (passwordRequired && form.password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return false
    }
    if (form.password && form.password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return false
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match")
      return false
    }
    return true
  }

  const requestCreateAdmin = (event: React.FormEvent) => {
    event.preventDefault()
    if (!validatePasswords(createForm, true)) return
    setAdminConfirmation("create")
  }

  const createAdmin = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setCreating(true)
    try {
      const response = await api.createAdmin(createForm.email.trim(), createForm.password)
      setAdmins((current) => [...current, response.user].sort((a, b) => a.id - b.id))
      setCreateForm(emptyForm)
      setAdminConfirmation(null)
      toast.success(`Admin ${response.user.email} created`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create admin")
    } finally {
      setCreating(false)
    }
  }

  const startEditing = (admin: User) => {
    setEditing(admin)
    setEditForm({ email: admin.email, password: "", confirmPassword: "" })
  }

  const requestUpdateAdmin = (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing || !validatePasswords(editForm, false)) return
    setAdminConfirmation("update")
  }

  const updateAdmin = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!editing) return

    setUpdating(true)
    try {
      const response = await api.updateAdmin(editing.id, editForm.email.trim(), editForm.password || undefined)
      setAdmins((current) => current.map((admin) => (admin.id === response.user.id ? response.user : admin)))
      if (currentUser?.id === response.user.id) await refresh()
      setAdminConfirmation(null)
      setEditing(null)
      setEditForm(emptyForm)
      toast.success(`Admin ${response.user.email} updated`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update admin")
    } finally {
      setUpdating(false)
    }
  }

  const hasEditChanges = Boolean(
    editing &&
      (editForm.email.trim() !== editing.email || Boolean(editForm.password) || Boolean(editForm.confirmPassword)),
  )

  const closeEditDialog = () => {
    setEditing(null)
    setEditForm(emptyForm)
  }

  const requestCloseEditDialog = () => {
    if (updating) return
    if (hasEditChanges) {
      setAdminConfirmation("discard-edit")
      return
    }
    closeEditDialog()
  }

  const confirmDiscardEdit = () => {
    setAdminConfirmation(null)
    closeEditDialog()
  }

  const deleteAdmin = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!deleting) return

    setDeletePending(true)
    try {
      await api.deleteAdmin(deleting.id)
      setAdmins((current) => current.filter((admin) => admin.id !== deleting.id))
      toast.success(`Admin ${deleting.email} deleted`)
      setDeleting(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete admin")
    } finally {
      setDeletePending(false)
    }
  }

  const renderAdminActions = (admin: User, isCurrentUser: boolean) => (
    <div className="flex shrink-0 justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => startEditing(admin)}
        aria-label={`Edit ${admin.email}`}
        title="Edit admin"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-destructive hover:text-destructive"
        onClick={() => setDeleting(admin)}
        disabled={isCurrentUser}
        aria-label={`Delete ${admin.email}`}
        title={isCurrentUser ? "You cannot delete yourself" : "Delete admin"}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Admins</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="flex h-[100dvh] w-full max-w-none flex-col gap-4 overflow-hidden rounded-none border-0 p-4 sm:h-auto sm:max-h-[92vh] sm:w-[calc(100%-2rem)] sm:max-w-4xl sm:rounded-lg sm:border sm:p-6">
          <DialogHeader className="shrink-0 pr-8 text-left">
            <DialogTitle>Admin users</DialogTitle>
            <DialogDescription>Create, view, update, and delete administrator accounts.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 sm:pr-2">
            <form className="grid gap-4 rounded-lg border p-4 md:grid-cols-3" onSubmit={requestCreateAdmin}>
              <div className="space-y-2 md:col-span-3">
                <div className="flex items-center gap-2 font-medium">
                  <UserPlus className="h-4 w-4" />
                  Add admin
                </div>
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="new-admin-email">Email</Label>
                <Input
                  id="new-admin-email"
                  type="email"
                  autoComplete="email"
                  value={createForm.email}
                  onChange={(event) => updateCreateForm("email", event.target.value)}
                  required
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="new-admin-password">Password</Label>
                <PasswordInput
                  id="new-admin-password"
                  autoComplete="new-password"
                  minLength={8}
                  value={createForm.password}
                  onChange={(event) => updateCreateForm("password", event.target.value)}
                  required
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="confirm-admin-password">Confirm password</Label>
                <PasswordInput
                  id="confirm-admin-password"
                  autoComplete="new-password"
                  minLength={8}
                  value={createForm.confirmPassword}
                  onChange={(event) => updateCreateForm("confirmPassword", event.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-3 md:flex md:justify-end">
                <Button type="submit" className="w-full md:w-auto" disabled={creating}>
                  {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Create admin
                </Button>
              </div>
            </form>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search admin users"
                aria-label="Search admin users"
                className="pl-9"
              />
            </div>

            <div className="hidden overflow-hidden rounded-lg border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : filteredAdmins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        No admin users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAdmins.map((admin) => {
                      const isCurrentUser = admin.id === currentUser?.id
                      return (
                        <TableRow key={admin.id}>
                          <TableCell>
                            <div className="flex items-center gap-2 font-medium">
                              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                              <span className="break-all">{admin.email}</span>
                              {isCurrentUser ? (
                                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">You</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{new Date(admin.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>{renderAdminActions(admin, isCurrentUser)}</TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 md:hidden">
              {loading ? (
                <div className="flex h-24 items-center justify-center rounded-lg border">
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                </div>
              ) : filteredAdmins.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-lg border px-4 text-center text-sm text-muted-foreground">
                  No admin users found.
                </div>
              ) : (
                filteredAdmins.map((admin) => {
                  const isCurrentUser = admin.id === currentUser?.id
                  return (
                    <article key={admin.id} className="rounded-xl border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-start gap-2 font-medium">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span className="min-w-0 break-all">{admin.email}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(admin.createdAt).toLocaleDateString()}</span>
                            {isCurrentUser ? <span className="rounded-full bg-muted px-2 py-0.5">You</span> : null}
                          </div>
                        </div>
                        {renderAdminActions(admin, isCurrentUser)}
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestCloseEditDialog()
        }}
      >
        <DialogContent className="w-[calc(100%-1.5rem)] p-4 sm:max-w-lg sm:p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>Edit admin</DialogTitle>
            <DialogDescription>Update the email or set a new password.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={requestUpdateAdmin}>
            <div className="space-y-2">
              <Label htmlFor="edit-admin-email">Email</Label>
              <Input
                id="edit-admin-email"
                type="email"
                autoComplete="email"
                value={editForm.email}
                onChange={(event) => updateEditForm("email", event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-admin-password">New password</Label>
              <PasswordInput
                id="edit-admin-password"
                autoComplete="new-password"
                minLength={8}
                value={editForm.password}
                onChange={(event) => updateEditForm("password", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-admin-confirm-password">Confirm new password</Label>
              <PasswordInput
                id="edit-admin-confirm-password"
                autoComplete="new-password"
                minLength={8}
                value={editForm.confirmPassword}
                onChange={(event) => updateEditForm("confirmPassword", event.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:space-x-0">
              <Button type="button" variant="outline" onClick={requestCloseEditDialog} disabled={updating}>
                Cancel
              </Button>
              <Button type="submit" disabled={updating}>
                {updating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(adminConfirmation)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !creating && !updating) setAdminConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {adminConfirmation === "create"
                ? "Create admin user?"
                : adminConfirmation === "update"
                  ? "Save admin changes?"
                  : "Discard admin changes?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {adminConfirmation === "create"
                ? `This will create a new administrator account for ${createForm.email.trim()}.`
                : adminConfirmation === "update"
                  ? `This will update ${editing?.email}${editForm.password ? " and replace the account password" : ""}.`
                  : "Your unsaved changes to this administrator account will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating || updating}>Cancel</AlertDialogCancel>
            {adminConfirmation === "create" ? (
              <AlertDialogAction onClick={createAdmin} disabled={creating}>
                {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create admin
              </AlertDialogAction>
            ) : adminConfirmation === "update" ? (
              <AlertDialogAction onClick={updateAdmin} disabled={updating}>
                {updating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                Save changes
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={confirmDiscardEdit}
              >
                Discard changes
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(nextOpen) => !nextOpen && !deletePending && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete admin user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleting?.email}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePending}
              onClick={deleteAdmin}
            >
              {deletePending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
