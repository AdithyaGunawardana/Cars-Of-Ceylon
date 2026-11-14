import { NextResponse } from "next/server";
import { requireSession, resolveVehicleManager } from "@/lib/api-auth";
import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/auth";
import {
  updateVehicleRequestSchema,
  vehicleDetailSuccessSchema,
  vehicleIdParamsSchema,
  updateVehicleSuccessSchema,
} from "@/lib/contracts/vehicle-contracts";
import { canManageVehicle, canViewVehicle } from "@/lib/authz";
import { writeModerationLog } from "@/lib/moderation-log";
import { prisma } from "@/lib/prisma";
import { getVehicleDetail, redactHiddenContent } from "@/lib/vehicle-queries";

// Returns one vehicle with timeline/photos and enforces private visibility rules.
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const parsed = vehicleIdParamsSchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const found = await getVehicleDetail(parsed.data.id);

  if (!found) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  // Deleted, hidden and private records are only visible to the owner / moderators (see canViewVehicle).
  const session = await getAuthSession();
  const viewer = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } })
    : null;
  // Return 404 for unauthorized access to avoid leaking record existence.
  if (!canViewVehicle(viewer, found)) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const vehicle = redactHiddenContent(found, canManageVehicle(viewer, found));

  // Keep response aligned with shared contract expectations.
  vehicleDetailSuccessSchema.parse({ vehicle });
  return NextResponse.json({ vehicle });
}

// Updates vehicle metadata for owner/moderator/admin users.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const parsedParams = vehicleIdParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsedBody = updateVehicleRequestSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid vehicle data", details: parsedBody.error.flatten() }, { status: 400 });
  }

  const access = await resolveVehicleManager(parsedParams.data.id, auth.userId);
  if (!access.ok) return access.response;
  const { vehicle } = access;

  try {
    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: parsedBody.data,
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        _count: {
          select: { photos: true, events: true },
        },
      },
    });

    updateVehicleSuccessSchema.parse({ vehicle: updatedVehicle });
    return NextResponse.json({ vehicle: updatedVehicle });
  } catch (error) {
    // Prisma unique constraint violations map to a user-actionable duplicate conflict.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A vehicle with this unique identifier or license plate already exists." }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to update vehicle" }, { status: 500 });
  }
}

// Soft-deletes a vehicle (owner/moderator/admin). Data stays recoverable until the purge job removes it.
export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const parsedParams = vehicleIdParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const access = await resolveVehicleManager(parsedParams.data.id, auth.userId);
  if (!access.ok) return access.response;
  const { vehicle, user } = access;

  await prisma.$transaction(async (tx) => {
    await tx.vehicle.update({ where: { id: vehicle.id }, data: { deletedAt: new Date(), deletedById: user.id } });
    // Owners deleting their own record is routine; only privileged deletions are audited.
    if (user.id !== vehicle.createdByUserId) {
      await writeModerationLog(tx, { actorId: user.id, action: "VEHICLE_DELETE", targetType: "VEHICLE", targetId: vehicle.id });
    }
  });
  return new NextResponse(null, { status: 204 });
}
