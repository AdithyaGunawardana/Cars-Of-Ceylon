import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-auth";
import { consumeToken } from "@/lib/auth-tokens";
import { resetPasswordSchema } from "@/lib/contracts/user-contracts";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

// Completes a password reset with the emailed single-use token.
export async function POST(request: Request) {
  const limit = rateLimit(`reset:ip:${getClientIp(request.headers)}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return errorResponse("Too many attempts. Please try again later.", 429, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const parsed = resetPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reset request", details: parsed.error.flatten() }, { status: 400 });
  }

  const email = await consumeToken("reset", parsed.data.token);
  if (!email) return errorResponse("This reset link is invalid or has expired.", 400);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, bannedAt: true } });
  if (!user || user.bannedAt) return errorResponse("This reset link is invalid or has expired.", 400);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      // Anyone holding an older session (for example the person who knew the old password) is signed out.
      sessionsValidAfter: new Date(),
      // Receiving the email at this address proves ownership of it.
      emailVerified: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
