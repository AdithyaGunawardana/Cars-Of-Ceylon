import type { AuthSession, Profile, ReportItem, VehicleDetail, VehicleListItem } from "./types";

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Request failed");
  }

  return payload as T;
}

export async function restoreSession() {
  const session = await requestJson<AuthSession | null>("/api/auth/session", {
    method: "GET",
  }).catch(() => null);

  return session?.user?.id ? session : null;
}

async function readCsrfToken() {
  const payload = await requestJson<{ csrfToken: string }>("/api/auth/csrf", {
    method: "GET",
  });

  return payload.csrfToken;
}

export async function signInWithCredentials(email: string, password: string) {
  const csrfToken = await readCsrfToken();
  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: "/",
    json: "true",
  });

  const response = await fetch(`${baseUrl}/api/auth/callback/credentials?json=true`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: body.toString(),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error ?? "Invalid email or password");
  }

  const session = await restoreSession();
  if (!session) {
    throw new Error("Signed in, but the session could not be restored.");
  }

  return session;
}

export async function registerAndSignIn(name: string, email: string, password: string) {
  await requestJson<{ user: { id: string } }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });

  return signInWithCredentials(email, password);
}

export async function signOutSession() {
  const csrfToken = await readCsrfToken();
  await fetch(`${baseUrl}/api/auth/signout`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ csrfToken, callbackUrl: "/" }).toString(),
  });
}

export async function listVehicles(params: {
  manufacturer?: string;
  model?: string;
  year?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const url = new URL(`${baseUrl}/api/vehicles`);
  if (params.manufacturer) url.searchParams.set("manufacturer", params.manufacturer);
  if (params.model) url.searchParams.set("model", params.model);
  if (params.year) url.searchParams.set("year", params.year);
  if (params.search) url.searchParams.set("search", params.search);
  url.searchParams.set("page", String(params.page ?? 1));
  url.searchParams.set("pageSize", String(params.pageSize ?? 10));

  return requestJson<{ items: VehicleListItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(url.pathname + url.search, {
    method: "GET",
  });
}

export async function getVehicle(vehicleId: string) {
  return requestJson<{ vehicle: VehicleDetail }>(`/api/vehicles/${vehicleId}`, { method: "GET" });
}

export async function updateVehicle(vehicleId: string, payload: Record<string, unknown>) {
  return requestJson<{ vehicle: VehicleDetail }>(`/api/vehicles/${vehicleId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteVehicle(vehicleId: string) {
  await requestJson(`/api/vehicles/${vehicleId}`, {
    method: "DELETE",
  });
}

export async function createVehicleEvent(vehicleId: string, payload: Record<string, unknown>) {
  return requestJson<{ event: { id: string } }>(`/api/vehicles/${vehicleId}/events`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateVehicleEvent(vehicleId: string, eventId: string, payload: Record<string, unknown>) {
  return requestJson<{ event: { id: string } }>(`/api/vehicles/${vehicleId}/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteVehicleEvent(vehicleId: string, eventId: string) {
  await requestJson(`/api/vehicles/${vehicleId}/events/${eventId}`, {
    method: "DELETE",
  });
}

export async function requestPhotoUpload(vehicleId: string, payload: { fileName: string; fileType: string; fileSize: number }) {
  return requestJson<{ uploadUrl: string; storageKey: string; publicUrl: string; expiresInSeconds: number; maxBytes: number }>(
    `/api/vehicles/${vehicleId}/photos/upload-url`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function finalizePhoto(vehicleId: string, payload: { storageKey: string; caption?: string | null }) {
  return requestJson<{ photo: { id: string } }>(`/api/vehicles/${vehicleId}/photos/finalize`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createReport(payload: { vehicleId: string; reason: string }) {
  return requestJson<{ report: { id: string } }>("/api/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listReports(params: { status?: string; page?: number; pageSize?: number }) {
  const url = new URL(`${baseUrl}/api/reports`);
  if (params.status) url.searchParams.set("status", params.status);
  url.searchParams.set("page", String(params.page ?? 1));
  url.searchParams.set("pageSize", String(params.pageSize ?? 10));

  return requestJson<{ items: ReportItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(url.pathname + url.search, {
    method: "GET",
  });
}

export async function updateReportStatus(reportId: string, status: "REVIEWING" | "RESOLVED" | "REJECTED") {
  return requestJson<{ report: { id: string } }>(`/api/reports/${reportId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function loadProfile(userId: string) {
  return requestJson<Profile>(`/api/users/${userId}`, { method: "GET" });
}

export async function followUser(userId: string) {
  return requestJson<{ following: boolean }>(`/api/users/${userId}/follow`, { method: "POST" });
}

export async function unfollowUser(userId: string) {
  return requestJson<{ following: boolean }>(`/api/users/${userId}/follow`, { method: "DELETE" });
}

export async function uploadPhotoWithProgress(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
  onProgress?: (progress: number) => void,
) {
  const blob = await (await fetch(fileUri)).blob();

  let xhr: XMLHttpRequest | null = null;

  const promise = new Promise<void>((resolve, reject) => {
    xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error("File upload failed."));
    };
    xhr.onerror = () => reject(new Error("File upload failed."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(blob);
  });

  return {
    promise,
    cancel: () => xhr?.abort(),
  };
}
