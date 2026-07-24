import * as React from "react"
import { LoaderCircle, Pencil, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react"
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

const emptyForm: AdminForm = { email: "", password: "", confirmPassword: "" }

export function CreateAdminDialog() {
  const { user: currentUser, refresh } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [admins, setAdmins] = React.useState<User[]>([])
  const [loading, setLoading] = React.useState(false)
  const [createForm, setCreateForm] = React.useState<AdminForm>(emptyForm)
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<User | null>(null)
  const [editForm, setEditForm] = React.useState<AdminForm>(emptyForm)
  const [updating, setUpdating] = React.useState(false)
  const [deleting, setDeleting] = React.useState<User | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)

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

  const createAdmin = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validatePasswords(createForm, true)) return

    setCreating(true)
    try {
      const response = await api.createAdmin(createForm.email.trim(), createForm.password)
      setAdmins((current) => [...current, response.user].sort((a, b) => a.id - b.id))
      setCreateForm(emptyForm)
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

  const updateAdmin = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing || !validatePasswords(editForm, false)) return

    setUpdating(true)
    try {
      const response = await api.updateAdmin(editing.id, editForm.email.trim(), editForm.password || undefined)
      setAdmins((current) => current.map((admin) => (admin.id === response.user.id ? response.user : admin)))
      if (currentUser?.id === response.user.id) await refresh()
      setEditing(null)
      setEditForm(emptyForm)
      toast.success(`Admin ${response.user.email} updated`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update admin")
    } finally {
      setUpdating(false)
    }
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

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Admins</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Admin users</DialogTitle>
            <DialogDescription>Create, view, update, and delete administrator accounts.</DialogDescription>
          </DialogHeader>

          <form className="grid gap-4 rounded-lg border p-4 md:grid-cols-3" onSubmit={createAdmin}>
            <div className="space-y-2 md:col-span-3">
              <div className="flex items-center gap-2 font-medium">
                <UserPlus className="h-4 w-4" />
                Add admin
              </div>
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2">
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
            <div className="space-y-2">
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
              <Button type="submit" disabled={creating}>
                {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create admin
              </Button>
            </div>
          </form>

          <div className="rounded-lg border">
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
                ) : admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No admin users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((admin) => {
                    const isCurrentUser = admin.id === currentUser?.id
                    return (
                      <TableRow key={admin.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 font-medium">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            <span className="break-all">{admin.email}</span>
                            {isCurrentUser ? (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">You</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{new Date(admin.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
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
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleting(admin)}
                              disabled={isCurrentUser}
                              aria-label={`Delete ${admin.email}`}
                              title={isCurrentUser ? "You cannot delete yourself" : "Delete admin"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(nextOpen) => !nextOpen && !updating && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit admin</DialogTitle>
            <DialogDescription>Update the email or set a new password.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={updateAdmin}>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={updating}>
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
