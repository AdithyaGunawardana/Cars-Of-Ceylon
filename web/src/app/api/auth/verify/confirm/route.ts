import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-auth";
import { consumeToken } from "@/lib/auth-tokens";
import { confirmEmailSchema } from "@/lib/contracts/user-contracts";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

// Confirms an email address from the emailed token. POST (not GET) so link prefetchers cannot consume the token.
export async function POST(request: Request) {
  const limit = rateLimit(`verify-confirm:ip:${getClientIp(request.headers)}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return errorResponse("Too many attempts. Please try again later.", 429, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const parsed = confirmEmailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid verification request", 400);

  const email = await consumeToken("verify", parsed.data.token);
  if (!email) return errorResponse("This verification link is invalid or has expired.", 400);

  const updated = await prisma.user.updateMany({ where: { email, emailVerified: null }, data: { emailVerified: new Date() } });
  return NextResponse.json({ ok: true, alreadyVerified: updated.count === 0 });
}
