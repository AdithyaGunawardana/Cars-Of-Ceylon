import { NextResponse } from "next/server";
import { errorResponse, requireSession, resolveVehicleManager } from "@/lib/api-auth";
import { isModerator } from "@/lib/authz";
import { vehicleIdParamsSchema } from "@/lib/contracts/vehicle-contracts";
import { writeModerationLog } from "@/lib/moderation-log";
import { prisma } from "@/lib/prisma";

// Restores a soft-deleted vehicle. Owners can undo their own deletion; a deletion made by a moderator
// can only be undone by a moderator.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const parsedParams = vehicleIdParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return errorResponse("Invalid vehicle id", 400);
  }

  const access = await resolveVehicleManager(parsedParams.data.id, auth.userId, { includeDeleted: true });
  if (!access.ok) return access.response;
  const { vehicle, user } = access;

  if (!vehicle.deletedAt) {
    return errorResponse("Vehicle is not deleted.", 409);
  }
  if (!isModerator(user) && vehicle.deletedById !== user.id) {
    return errorResponse("Forbidden", 403);
  }

  await prisma.$transaction(async (tx) => {
    await tx.vehicle.update({ where: { id: vehicle.id }, data: { deletedAt: null, deletedById: null } });
    if (isModerator(user)) {
      await writeModerationLog(tx, { actorId: user.id, action: "VEHICLE_RESTORE", targetType: "VEHICLE", targetId: vehicle.id });
    }
  });

  return NextResponse.json({ restored: true });
}
