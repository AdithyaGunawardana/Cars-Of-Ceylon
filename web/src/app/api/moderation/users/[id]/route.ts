import { NextResponse } from "next/server";
import { errorResponse, requireSession, resolveModerator } from "@/lib/api-auth";
import { canBanUser } from "@/lib/authz";
import { banUserRequestSchema } from "@/lib/contracts/moderation-contracts";
import { userIdParamsSchema } from "@/lib/contracts/user-contracts";
import { writeModerationLog } from "@/lib/moderation-log";
import { prisma } from "@/lib/prisma";

// Ban or unban an account. Banned users cannot sign in and every protected API call returns 403.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const moderator = await resolveModerator(auth.userId);
  if (!moderator.ok) return moderator.response;

  const parsedParams = userIdParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) return errorResponse("Invalid user id", 400);

  const parsed = banUserRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ban request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { banned, reason } = parsed.data;

  const target = await prisma.user.findUnique({
    where: { id: parsedParams.data.id },
    select: { id: true, role: true, bannedAt: true },
  });
  if (!target) return errorResponse("User not found", 404);
  if (!canBanUser(moderator.user, target)) return errorResponse("Forbidden", 403);
  if (Boolean(target.bannedAt) === banned) {
    return errorResponse(banned ? "User is already banned." : "User is not banned.", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: banned ? { bannedAt: new Date(), banReason: reason } : { bannedAt: null, banReason: null },
    });
    await writeModerationLog(tx, {
      actorId: moderator.user.id,
      action: banned ? "USER_BAN" : "USER_UNBAN",
      targetType: "USER",
      targetId: target.id,
      reason,
    });
  });

  return NextResponse.json({ userId: target.id, banned });
}
