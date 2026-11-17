import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-auth";
import { sendPasswordResetEmail } from "@/lib/account-emails";
import { forgotPasswordSchema } from "@/lib/contracts/user-contracts";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

// Always answers 200 with the same body, whether or not the address has an account, so this endpoint cannot be
// used to discover which emails are registered.
export async function POST(request: Request) {
  const hour = 60 * 60 * 1000;
  const ipLimit = rateLimit(`forgot:ip:${getClientIp(request.headers)}`, 10, hour);
  if (!ipLimit.allowed) {
    return errorResponse("Too many requests. Please try again later.", 429, {
      headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
    });
  }

  const parsed = forgotPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Enter a valid email address.", 400);

  const response = NextResponse.json({ ok: true });

  // Per-address limit stops mailbox flooding; exceeding it is silent for the same reason as above.
  if (!rateLimit(`forgot:email:${parsed.data.email}`, 3, hour).allowed) return response;

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { email: true, passwordHash: true, bannedAt: true },
  });
  // Social-login-only and suspended accounts have nothing to reset.
  if (user?.passwordHash && !user.bannedAt) {
    await sendPasswordResetEmail(user.email).catch((error: unknown) => console.error("Failed to send reset email", error));
  }

  return response;
}
