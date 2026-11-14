import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api-auth";
import { sendVerificationEmail } from "@/lib/account-emails";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

// (Re)sends the verification email for the signed-in account.
export async function POST() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`verify-send:${auth.userId}`, 3, 60 * 60 * 1000);
  if (!limit.allowed) {
    return errorResponse("Too many verification emails requested. Please try again later.", 429, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true, emailVerified: true } });
  if (!user) return errorResponse("Unauthorized", 401);
  if (user.emailVerified) return errorResponse("Email is already verified.", 409);

  await sendVerificationEmail(user.email);
  return NextResponse.json({ ok: true });
}
