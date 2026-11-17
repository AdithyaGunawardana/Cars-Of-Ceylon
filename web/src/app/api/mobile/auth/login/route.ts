import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCredentials } from "@/lib/credentials";
import { issueSession } from "@/lib/mobile-tokens";
import { getClientIp } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string(),
  password: z.string(),
  deviceName: z.string().trim().max(80).optional(),
});

// Mobile sign-in: exchange email + password for a short-lived access token and a rotating refresh token.
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login data" }, { status: 400 });
  }

  const result = await verifyCredentials(parsed.data, getClientIp(request.headers));
  if (result.status === "throttled") {
    return NextResponse.json({ error: "Too many sign-in attempts. Please try again later." }, { status: 429, headers: { "Retry-After": "900" } });
  }
  if (result.status !== "ok") {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const pair = await issueSession(result.user.id, parsed.data.deviceName);
  if (!pair) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  return NextResponse.json(pair, { headers: { "Cache-Control": "no-store" } });
}
