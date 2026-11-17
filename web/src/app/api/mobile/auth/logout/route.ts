import { NextResponse } from "next/server";
import { z } from "zod";
import { revokeByRefreshToken } from "@/lib/mobile-tokens";

const logoutSchema = z.object({ refreshToken: z.string().min(1).max(200) });

// Signs this device out by revoking its refresh-token family. Idempotent: unknown tokens still return 204.
export async function POST(request: Request) {
  const parsed = logoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid logout request" }, { status: 400 });
  }
  await revokeByRefreshToken(parsed.data.refreshToken);
  return new NextResponse(null, { status: 204 });
}
