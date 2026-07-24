import type { PreviewRecord, UploadDetail, UploadRecord, User, WorkbookSheet } from "@/lib/types"

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | object | null
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const inputBody = options.body
  let body: BodyInit | null | undefined

  if (inputBody && typeof inputBody === "object" && !(inputBody instanceof FormData) && !(inputBody instanceof Blob)) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(inputBody)
  } else {
    body = inputBody as BodyInit | null | undefined
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body,
    credentials: "include",
    cache: options.cache ?? "no-store",
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const payload = (await response.json()) as { error?: string }
      if (payload.error) message = payload.error
    } catch {
      // Keep the HTTP fallback message.
    }
    throw new Error(message)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

async function requestBlob(path: string): Promise<Blob> {
  const response = await fetch(path, {
    credentials: "include",
    cache: "no-store",
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const payload = (await response.json()) as { error?: string }
      if (payload.error) message = payload.error
    } catch {
      // Keep the HTTP fallback message.
    }
    throw new Error(message)
  }

  return response.blob()
}

export const api = {
  me: () => request<{ user: User | null }>("/api/users/me"),
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/login", { method: "POST", body: { email, password } }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  listAdmins: () => request<{ users: User[] }>("/api/users"),
  getAdmin: (id: number) => request<{ user: User }>(`/api/users/${id}`),
  createAdmin: (email: string, password: string) =>
    request<{ user: User }>("/api/users", { method: "POST", body: { email, password } }),
  updateAdmin: (id: number, email: string, password?: string) =>
    request<{ user: User }>(`/api/users/${id}`, {
      method: "PATCH",
      body: { email, ...(password ? { password } : {}) },
    }),
  deleteAdmin: (id: number) => request<void>(`/api/users/${id}`, { method: "DELETE" }),

  listUploads: () => request<{ uploads: UploadRecord[] }>("/api/repositories"),
  getUpload: (id: string) => request<UploadDetail>(`/api/repositories/${id}`),
  previewUpload: (form: FormData) =>
    request<{ preview: PreviewRecord }>("/api/repositories/preview", { method: "POST", body: form }),
  discardPreview: (id: string) => request<void>(`/api/repository-previews/${id}`, { method: "DELETE" }),
  savePreview: (previewId: string) =>
    request<{ upload: UploadRecord }>("/api/repositories", { method: "POST", body: { previewId } }),
  updateUpload: (
    id: string,
    body: { college?: string; filename?: string; sheets?: WorkbookSheet[] },
  ) => {
    const { filename, ...updates } = body
    return request<UploadDetail | { upload: UploadRecord }>(`/api/repositories/${id}`, {
      method: "PATCH",
      body: {
        ...updates,
        ...(filename !== undefined
          ? {
              filename,
              originalName: filename,
              original_name: filename,
            }
          : {}),
      },
    })
  },
  downloadUpload: (id: string) => requestBlob(`/api/repositories/${id}/download`),
  deleteUpload: (id: string) => request<void>(`/api/repositories/${id}`, { method: "DELETE" }),
}
