import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/api-auth";
import { changePasswordSchema } from "@/lib/contracts/user-contracts";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

// Change the signed-in user's password; requires the current password.
export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  // Throttle guessing of the current password from a hijacked session.
  const limit = rateLimit(`password-change:${auth.userId}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return errorResponse("Too many attempts. Please try again later.", 429, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const parsed = changePasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid password data", details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { passwordHash: true } });
  if (!user) return errorResponse("Unauthorized", 401);
  if (!user.passwordHash) {
    return errorResponse("This account has no password set.", 400);
  }

  const matches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!matches) return errorResponse("Current password is incorrect.", 403);

  await prisma.user.update({
    where: { id: auth.userId },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) },
  });

  return NextResponse.json({ ok: true });
}
