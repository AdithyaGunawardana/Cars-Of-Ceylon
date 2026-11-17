import Constants from "expo-constants";

// Where the web API lives.
//  1. EXPO_PUBLIC_API_BASE_URL always wins (set it in mobile/.env.local, or per profile in eas.json).
//  2. In development on a phone, Expo Go knows the PC's LAN address (it is how the bundle was loaded),
//     so we reuse that host on the web server's port 3000. No manual IP editing needed.
//  3. Otherwise fall back to localhost (emulators on the same machine).
const DEV_API_PORT = 3000;

export function resolveApiBaseUrl(
  env: string | undefined = process.env.EXPO_PUBLIC_API_BASE_URL,
  hostUri: string | undefined = Constants.expoConfig?.hostUri,
): string {
  const configured = env?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const host = hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${DEV_API_PORT}`;
  }
  return `http://localhost:${DEV_API_PORT}`;
}

// Release builds must talk to the API over HTTPS: tokens and passwords would otherwise cross the network in the clear.
// Development builds (and EAS "development" profiles that set EXPO_PUBLIC_ALLOW_CLEARTEXT=1) may use plain HTTP.
export function assertSecureBaseUrl(url: string, isDev: boolean, allowCleartext: boolean): string {
  if (isDev || allowCleartext || url.startsWith("https://")) return url;
  throw new Error(`Refusing to use an insecure API address in a release build: ${url}. Set EXPO_PUBLIC_API_BASE_URL to an https:// URL.`);
}

export const API_BASE_URL = assertSecureBaseUrl(resolveApiBaseUrl(), __DEV__, process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === "1");

// Photos uploaded in development are served from MinIO at "localhost", which a phone cannot reach.
// Reading is unsigned, so swapping in the API host is safe for display. (Uploads are signed for a specific
// host, so UPLOAD_S3_ENDPOINT must be the PC's LAN address when testing uploads from a phone.)
export function mediaUrl(url: string | null | undefined, apiBase: string = API_BASE_URL): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      const api = new URL(apiBase);
      if (api.hostname !== "localhost" && api.hostname !== "127.0.0.1") {
        parsed.hostname = api.hostname;
        return parsed.toString();
      }
    }
  } catch {
    // Not an absolute URL; use as-is.
  }
  return url;
}
