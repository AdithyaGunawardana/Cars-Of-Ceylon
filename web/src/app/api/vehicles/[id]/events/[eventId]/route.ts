import { NextResponse } from "next/server";
import { getAuthSession } from "@/auth";
import { updateVehicleEventRequestSchema, vehicleEventParamsSchema } from "@/lib/contracts/vehicle-contracts";
import { prisma } from "@/lib/prisma";

async function getCurrentUserWithVehicle(params: { id: string; eventId: string }, userId: string) {
  const [vehicle, currentUser, event] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id: params.id }, select: { id: true, createdByUserId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
    prisma.vehicleEvent.findUnique({ where: { id: params.eventId }, select: { id: true, vehicleId: true } }),
  ]);

  return { vehicle, currentUser, event };
}

// Updates a timeline event for owners/moderators/admins when it belongs to the target vehicle.
export async function PATCH(request: Request, context: { params: Promise<{ id: string; eventId: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedParams = vehicleEventParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid route parameters" }, { status: 400 });
  }

  const parsedBody = updateVehicleEventRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid event data", details: parsedBody.error.flatten() }, { status: 400 });
  }

  const { vehicle, currentUser, event } = await getCurrentUserWithVehicle(parsedParams.data, session.user.id);

  if (!vehicle || !event || event.vehicleId !== vehicle.id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canContribute =
    vehicle.createdByUserId === currentUser.id || currentUser.role === "MODERATOR" || currentUser.role === "ADMIN";

  if (!canContribute) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const eventRecord = await prisma.vehicleEvent.update({
    where: { id: event.id },
    data: {
      ...(parsedBody.data.type !== undefined ? { type: parsedBody.data.type } : {}),
      ...(parsedBody.data.title !== undefined ? { title: parsedBody.data.title } : {}),
      ...(parsedBody.data.details !== undefined ? { details: parsedBody.data.details } : {}),
      ...(parsedBody.data.sourceUrl !== undefined ? { sourceUrl: parsedBody.data.sourceUrl } : {}),
      ...(parsedBody.data.occurredAt !== undefined
        ? { occurredAt: parsedBody.data.occurredAt ? new Date(parsedBody.data.occurredAt) : null }
        : {}),
    },
  });

  return NextResponse.json({ event: eventRecord }, { status: 200 });
}

// Deletes a timeline event for owners/moderators/admins when it belongs to the target vehicle.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string; eventId: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedParams = vehicleEventParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid route parameters" }, { status: 400 });
  }

  const { vehicle, currentUser, event } = await getCurrentUserWithVehicle(parsedParams.data, session.user.id);

  if (!vehicle || !event || event.vehicleId !== vehicle.id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canContribute =
    vehicle.createdByUserId === currentUser.id || currentUser.role === "MODERATOR" || currentUser.role === "ADMIN";

  if (!canContribute) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.vehicleEvent.delete({ where: { id: event.id } });
  return new Response(null, { status: 204 });
}
