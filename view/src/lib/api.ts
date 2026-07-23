import type {
  PreviewRecord,
  UploadDetail,
  UploadRecord,
  User,
  WorkbookSheet,
} from "@/lib/types";

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | object | null;
};

type UploadOptions = {
  onProgress?: (percentage: number) => void;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const inputBody = options.body;
  let body: BodyInit | null | undefined;

  if (
    inputBody &&
    typeof inputBody === "object" &&
    !(inputBody instanceof FormData) &&
    !(inputBody instanceof Blob)
  ) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(inputBody);
  } else {
    body = inputBody as BodyInit | null | undefined;
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body,
    credentials: "include",
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Keep the HTTP fallback message.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function uploadForm<T>(
  path: string,
  form: FormData,
  options: UploadOptions = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", abortUpload);
      callback();
    };

    const abortUpload = () => xhr.abort();

    xhr.open("POST", path);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || !options.onProgress) return;
      options.onProgress(
        Math.min(100, Math.round((event.loaded / event.total) * 100)),
      );
    });

    xhr.addEventListener("load", () => {
      finish(() => {
        let payload: unknown = null;
        try {
          payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          // Fall back to the HTTP status message below when the body is not JSON.
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          options.onProgress?.(100);
          resolve(payload as T);
          return;
        }

        const message =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : `Upload failed (${xhr.status || "network error"})`;
        reject(new Error(message));
      });
    });

    xhr.addEventListener("error", () => {
      finish(() =>
        reject(
          new Error(
            "Unable to reach the server. Check your connection and try again.",
          ),
        ),
      );
    });

    xhr.addEventListener("abort", () => {
      finish(() => reject(new DOMException("Upload cancelled", "AbortError")));
    });

    if (options.signal?.aborted) {
      finish(() => reject(new DOMException("Upload cancelled", "AbortError")));
      return;
    }
    options.signal?.addEventListener("abort", abortUpload, { once: true });
    xhr.send(form);
  });
}

export const api = {
  me: () => request<{ user: User | null }>("/api/users/me"),
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  listUploads: () => request<{ uploads: UploadRecord[] }>("/api/repositories"),
  getUpload: (id: string) => request<UploadDetail>(`/api/repositories/${id}`),
  previewUpload: (form: FormData, options?: UploadOptions) =>
    uploadForm<{ preview: PreviewRecord }>(
      "/api/repositories/preview",
      form,
      options,
    ),
  discardPreview: (id: string) =>
    request<void>(`/api/repository-previews/${id}`, { method: "DELETE" }),
  savePreview: (previewId: string) =>
    request<{ upload: UploadRecord }>("/api/repositories", {
      method: "POST",
      body: { previewId },
    }),
  updateUpload: (
    id: string,
    body: {
      college: string;
      eventDate: string;
      eventTime: string;
      sheets?: WorkbookSheet[];
    },
  ) =>
    request<UploadDetail | { upload: UploadRecord }>(
      `/api/repositories/${id}`,
      { method: "PATCH", body },
    ),
  deleteUpload: (id: string) =>
    request<void>(`/api/repositories/${id}`, { method: "DELETE" }),
};
