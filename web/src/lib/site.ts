// Canonical public origin used for metadata, sitemap and absolute links.
export function getSiteUrl() {
  const raw = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export const SITE_NAME = "Cars of Ceylon";
export const SITE_DESCRIPTION = "A web archive for Sri Lankan vehicle history, photos, and timelines.";
