import * as Device from "expo-device";
import { API_BASE_URL } from "./config";
import { clearStoredAuth, loadStoredAuth, saveStoredAuth } from "./token-store";
import type { SessionUser } from "./types";

// Low-level HTTP + token handling. Access tokens are short-lived (15 min) and held in memory; the long-lived
// refresh token is single-use and lives in secure storage. A request transparently refreshes when the access token is
// about to expire or the server answers 401.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type TokenPair = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: SessionUser;
};

const REFRESH_MARGIN_MS = 30_000;
const REQUEST_TIMEOUT_MS = 20_000;

let access: { token: string; expiresAt: number } | null = null;
let refreshInFlight: Promise<SessionUser> | null = null;
let signedOutHandler: (() => void) | null = null;

/** The session provider registers this to be told when the server rejects our refresh token. */
export function setSignedOutHandler(handler: (() => void) | null) {
  signedOutHandler = handler;
}

/** Test helper: forget in-memory state. */
export function resetApiClientState() {
  access = null;
  refreshInFlight = null;
  signedOutHandler = null;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("The server took too long to respond.", 0);
    }
    throw new ApiError("Could not reach the server. Check your connection.", 0);
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response: Response) {
  return response.json().catch(() => null) as Promise<{ error?: string; details?: unknown } | null>;
}

async function applyTokenPair(pair: TokenPair) {
  access = { token: pair.accessToken, expiresAt: new Date(pair.accessTokenExpiresAt).getTime() };
  // Persist the rotated refresh token before anything else can use the (now single-use) old one.
  await saveStoredAuth({ refreshToken: pair.refreshToken, refreshTokenExpiresAt: pair.refreshTokenExpiresAt, user: pair.user });
}

async function postJson(path: string, body: unknown) {
  return fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deviceName() {
  return [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || "Mobile app";
}

export async function signInWithPassword(email: string, password: string): Promise<SessionUser> {
  const response = await postJson("/api/mobile/auth/login", { email, password, deviceName: deviceName() });
  const payload = await readJson(response);
  if (!response.ok) throw new ApiError(payload?.error ?? "Sign in failed.", response.status);
  await applyTokenPair(payload as unknown as TokenPair);
  return (payload as unknown as TokenPair).user;
}

/**
 * Exchanges the stored refresh token for a new pair. Concurrent callers share one request, because refresh tokens are
 * single-use. Only a definite rejection from the server signs the user out; network failures keep the session.
 */
export function refreshSession(): Promise<SessionUser> {
  refreshInFlight ??= (async () => {
    const stored = await loadStoredAuth();
    if (!stored) throw new ApiError("Not signed in.", 401);

    const response = await postJson("/api/mobile/auth/refresh", { refreshToken: stored.refreshToken });
    const payload = await readJson(response);
    if (response.status === 400 || response.status === 401) {
      access = null;
      await clearStoredAuth();
      signedOutHandler?.();
      throw new ApiError(payload?.error ?? "Session expired. Please sign in again.", 401);
    }
    if (!response.ok) throw new ApiError(payload?.error ?? "Could not refresh the session.", response.status);

    await applyTokenPair(payload as unknown as TokenPair);
    return (payload as unknown as TokenPair).user;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function signOutDevice() {
  const stored = await loadStoredAuth();
  access = null;
  await clearStoredAuth();
  if (stored) {
    // Best effort: even if this fails the local credentials are gone, and the token expires on its own.
    await postJson("/api/mobile/auth/logout", { refreshToken: stored.refreshToken }).catch(() => undefined);
  }
}

type RequestOptions = { auth?: boolean; query?: Record<string, string | number | undefined | null> };

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth ?? true;

  async function send() {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.json !== undefined) headers["Content-Type"] = "application/json";
    if (useAuth && access) headers.Authorization = `Bearer ${access.token}`;
    return fetchWithTimeout(buildUrl(path, options.query), {
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  }

  if (useAuth && (!access || access.expiresAt - Date.now() < REFRESH_MARGIN_MS)) {
    await refreshSession();
  }

  let response = await send();
  if (response.status === 401 && useAuth) {
    // The token may have been revoked or the clock may be off: refresh once and retry once.
    await refreshSession();
    response = await send();
  }

  if (response.status === 204) return undefined as T;
  const payload = await readJson(response);
  if (!response.ok) {
    throw new ApiError(payload?.error ?? `Request failed (${response.status})`, response.status, payload?.details);
  }
  return payload as T;
}
