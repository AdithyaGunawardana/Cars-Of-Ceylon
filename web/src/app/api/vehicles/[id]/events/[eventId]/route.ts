import { NextResponse } from "next/server";
import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateVehicleEventRequestSchema, vehicleIdParamsSchema } from "@/lib/contracts/vehicle-contracts";

async function resolveVehicleAndUser(vehicleId: string, userId: string) {
  return Promise.all([
    prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, createdByUserId: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    }),
  ]);
}

async function resolveEvent(vehicleId: string, eventId: string) {
  return prisma.vehicleEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      vehicleId: true,
    },
  }).then((event) => (event && event.vehicleId === vehicleId ? event : null));
}

// Allows owners, moderators, and admins to edit timeline event metadata.
export async function PATCH(request: Request, context: { params: Promise<{ id: string; eventId: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedParams = vehicleIdParamsSchema.safeParse({ id: params.id });
  if (!parsedParams.success || !params.eventId) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsedBody = updateVehicleEventRequestSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid event data", details: parsedBody.error.flatten() }, { status: 400 });
  }

  const [vehicle, currentUser] = await resolveVehicleAndUser(parsedParams.data.id, session.user.id);
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage =
    vehicle.createdByUserId === currentUser.id || currentUser.role === "MODERATOR" || currentUser.role === "ADMIN";
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await resolveEvent(vehicle.id, params.eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const updatedEvent = await prisma.vehicleEvent.update({
    where: { id: params.eventId },
    data: {
      ...(parsedBody.data.type ? { type: parsedBody.data.type } : {}),
      ...(parsedBody.data.title ? { title: parsedBody.data.title } : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody.data, "details")
        ? { details: parsedBody.data.details }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody.data, "occurredAt")
        ? { occurredAt: parsedBody.data.occurredAt ? new Date(parsedBody.data.occurredAt) : null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedBody.data, "sourceUrl")
        ? { sourceUrl: parsedBody.data.sourceUrl }
        : {}),
    },
  });

  return NextResponse.json({ event: updatedEvent });
}

// Allows owners, moderators, and admins to remove a timeline event.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string; eventId: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedParams = vehicleIdParamsSchema.safeParse({ id: params.id });
  if (!parsedParams.success || !params.eventId) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const [vehicle, currentUser] = await resolveVehicleAndUser(parsedParams.data.id, session.user.id);
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage =
    vehicle.createdByUserId === currentUser.id || currentUser.role === "MODERATOR" || currentUser.role === "ADMIN";
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await resolveEvent(vehicle.id, params.eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.vehicleEvent.delete({
    where: { id: params.eventId },
  });

  return new NextResponse(null, { status: 204 });
}
