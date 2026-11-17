import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// Days a deleted vehicle stays restorable before the cleanup job erases it (see scripts/storage-cleanup.ts).
const DELETED_RETENTION_DAYS = 30;

// The signed-in user's soft-deleted vehicles. `restorable` is false when a moderator removed the record, because
// only a moderator may undo that.
export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const vehicles = await prisma.vehicle.findMany({
    where: { createdByUserId: auth.userId, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    select: { id: true, manufacturer: true, model: true, year: true, uniqueIdentifier: true, deletedAt: true, deletedById: true },
  });

  const items = vehicles.map((vehicle) => {
    const deletedAt = vehicle.deletedAt!;
    return {
      id: vehicle.id,
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      year: vehicle.year,
      uniqueIdentifier: vehicle.uniqueIdentifier,
      deletedAt: deletedAt.toISOString(),
      restorable: vehicle.deletedById === auth.userId,
      purgeOn: new Date(deletedAt.getTime() + DELETED_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };
  });

  return NextResponse.json({ items });
}
