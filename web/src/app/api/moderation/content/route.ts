import { NextResponse } from "next/server";
import { errorResponse, requireSession, resolveModerator } from "@/lib/api-auth";
import { hideContentRequestSchema } from "@/lib/contracts/moderation-contracts";
import { writeModerationLog } from "@/lib/moderation-log";
import { prisma } from "@/lib/prisma";

// Moderators/admins hide or unhide a vehicle, photo or timeline event. Hidden content stays visible to the
// owner and moderators but disappears from public listings and detail views.
export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const moderator = await resolveModerator(auth.userId);
  if (!moderator.ok) return moderator.response;

  const parsed = hideContentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid moderation request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { targetType, targetId, hidden, reason } = parsed.data;

  const hiddenAt = hidden ? new Date() : null;

  const result = await prisma.$transaction(async (tx) => {
    // Each model has the same `id` / `hiddenAt` shape, so branch explicitly to keep Prisma's types intact.
    let currentlyHidden: boolean;
    if (targetType === "VEHICLE") {
      const row = await tx.vehicle.findUnique({ where: { id: targetId }, select: { hiddenAt: true } });
      if (!row) return "missing" as const;
      currentlyHidden = Boolean(row.hiddenAt);
      if (currentlyHidden !== hidden) await tx.vehicle.update({ where: { id: targetId }, data: { hiddenAt } });
    } else if (targetType === "PHOTO") {
      const row = await tx.vehiclePhoto.findUnique({ where: { id: targetId }, select: { hiddenAt: true } });
      if (!row) return "missing" as const;
      currentlyHidden = Boolean(row.hiddenAt);
      if (currentlyHidden !== hidden) await tx.vehiclePhoto.update({ where: { id: targetId }, data: { hiddenAt } });
    } else {
      const row = await tx.vehicleEvent.findUnique({ where: { id: targetId }, select: { hiddenAt: true } });
      if (!row) return "missing" as const;
      currentlyHidden = Boolean(row.hiddenAt);
      if (currentlyHidden !== hidden) await tx.vehicleEvent.update({ where: { id: targetId }, data: { hiddenAt } });
    }

    if (currentlyHidden === hidden) return "noop" as const;

    await writeModerationLog(tx, {
      actorId: moderator.user.id,
      action: hidden ? "CONTENT_HIDE" : "CONTENT_UNHIDE",
      targetType,
      targetId,
      reason,
    });
    return "ok" as const;
  });

  if (result === "missing") return errorResponse("Content not found", 404);
  if (result === "noop") return errorResponse(hidden ? "Content is already hidden." : "Content is not hidden.", 409);

  return NextResponse.json({ targetType, targetId, hidden });
}
