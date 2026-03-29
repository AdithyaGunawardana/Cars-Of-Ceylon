export type VehicleListItem = {
  id: string;
  uniqueIdentifier: string;
  manufacturer: string;
  model: string;
  year: number;
};

export type VehicleDetail = {
  id: string;
  uniqueIdentifier: string;
  licensePlate: string | null;
  manufacturer: string;
  model: string;
  year: number;
  description: string | null;
  events: Array<{
    id: string;
    type: string;
    title: string;
    details: string | null;
    createdAt: string;
  }>;
};

function getApiBaseUrl() {
  // Expo injects EXPO_PUBLIC_* vars at build/runtime; fallback helps local emulator testing.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
}

async function request<T>(path: string, options?: RequestInit) {
  // Shared fetch wrapper keeps status/error handling consistent across mobile screens.
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return payload as T;
}

export async function fetchVehicles() {
  // Matches web contract pagination defaults for initial mobile MVP listing.
  const payload = await request<{ items: VehicleListItem[] }>("/api/vehicles?page=1&pageSize=20");
  return payload.items;
}

export async function fetchVehicleDetail(id: string) {
  const payload = await request<{ vehicle: VehicleDetail }>(`/api/vehicles/${id}`);
  return payload.vehicle;
}

export async function loginWithCredentials(email: string, password: string) {
  // Credentials callback is reused until dedicated mobile token exchange is introduced.
  const response = await fetch(`${getApiBaseUrl()}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      email,
      password,
      redirect: "false",
      callbackUrl: `${getApiBaseUrl()}/`,
      json: "true",
    }).toString(),
  });

  if (!response.ok) {
    throw new Error("Invalid login credentials.");
  }

  return "cookie-session";
}
