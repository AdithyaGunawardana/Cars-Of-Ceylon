import * as SecureStore from "expo-secure-store";
import type { SessionUser } from "./types";

// The refresh token and the last-known user live in the device keychain / keystore. The short-lived access token is
// only ever held in memory (see api-client.ts).
const KEY = "cars-of-ceylon.auth.v1";

export type StoredAuth = {
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: SessionUser;
};

export async function loadStoredAuth(): Promise<StoredAuth | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (typeof parsed.refreshToken !== "string" || !parsed.user?.id) return null;
    return parsed as StoredAuth;
  } catch {
    return null;
  }
}

export async function saveStoredAuth(auth: StoredAuth) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(auth));
}

export async function clearStoredAuth() {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing stored or keystore unavailable; either way there is nothing left to clear.
  }
}
