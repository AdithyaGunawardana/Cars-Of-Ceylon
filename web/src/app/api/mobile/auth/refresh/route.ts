import { NextResponse } from "next/server";
import { z } from "zod";
import { rotateRefreshToken } from "@/lib/mobile-tokens";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

// Exchange a refresh token for a new access + refresh pair. The presented refresh token is single-use.
export async function POST(request: Request) {
  const limit = rateLimit(`mobile-refresh:${getClientIp(request.headers)}`, 120, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const parsed = refreshSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid refresh request" }, { status: 400 });
  }

  const result = await rotateRefreshToken(parsed.data.refreshToken);
  if (!result.ok) {
    // Same message for unknown, expired, revoked and replayed tokens: the app just signs the user out.
    return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 });
  }
  return NextResponse.json(result.pair, { headers: { "Cache-Control": "no-store" } });
}
