import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/auth";
import {
  updateVehicleRequestSchema,
  vehicleDetailSuccessSchema,
  vehicleIdParamsSchema,
  updateVehicleSuccessSchema,
} from "@/lib/contracts/vehicle-contracts";
import { prisma } from "@/lib/prisma";

// Returns one vehicle with timeline/photos and enforces private visibility rules.
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const parsed = vehicleIdParamsSchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: parsed.data.id },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      events: {
        orderBy: { createdAt: "desc" },
      },
      photos: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  if (vehicle.visibility === "PRIVATE") {
    const session = await getAuthSession();
    // Return 404 for unauthorized private access to avoid leaking record existence.
    const canViewPrivate = session?.user?.id === vehicle.createdByUserId;
    if (!canViewPrivate) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
  }

  // Keep response aligned with shared contract expectations.
  vehicleDetailSuccessSchema.parse({ vehicle });
  return NextResponse.json({ vehicle });
}

// Updates vehicle metadata for owner/moderator/admin users.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const [vehicle, currentUser] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id: parsedParams.data.id }, select: { id: true, createdByUserId: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } }),
  ]);

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage =
    currentUser.id === vehicle.createdByUserId || currentUser.role === "MODERATOR" || currentUser.role === "ADMIN";

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

// Deletes a vehicle record for owner/moderator/admin users.
export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedParams = vehicleIdParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const [vehicle, currentUser] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id: parsedParams.data.id }, select: { id: true, createdByUserId: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } }),
  ]);

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage =
    currentUser.id === vehicle.createdByUserId || currentUser.role === "MODERATOR" || currentUser.role === "ADMIN";

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.vehicle.delete({ where: { id: vehicle.id } });
  return new NextResponse(null, { status: 204 });
}
