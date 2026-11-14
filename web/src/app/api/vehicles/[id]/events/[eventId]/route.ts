import { NextResponse } from "next/server";
import { requireSession, resolveVehicleManager } from "@/lib/api-auth";
import { updateVehicleEventRequestSchema, vehicleIdParamsSchema } from "@/lib/contracts/vehicle-contracts";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; eventId: string }> };

// Event must belong to the vehicle in the URL, otherwise it is treated as missing.
async function findEventOfVehicle(vehicleId: string, eventId: string) {
  const event = await prisma.vehicleEvent.findUnique({
    where: { id: eventId },
    select: { id: true, vehicleId: true },
  });
  return event && event.vehicleId === vehicleId ? event : null;
}

// Allows owners, moderators, and admins to edit timeline event metadata.
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

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

  const access = await resolveVehicleManager(parsedParams.data.id, auth.userId);
  if (!access.ok) return access.response;

  const event = await findEventOfVehicle(access.vehicle.id, params.eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const data = parsedBody.data;
  const updatedEvent = await prisma.vehicleEvent.update({
    where: { id: params.eventId },
    data: {
      ...(data.type ? { type: data.type } : {}),
      ...(data.title ? { title: data.title } : {}),
      ...(Object.prototype.hasOwnProperty.call(data, "details") ? { details: data.details } : {}),
      ...(Object.prototype.hasOwnProperty.call(data, "occurredAt")
        ? { occurredAt: data.occurredAt ? new Date(data.occurredAt) : null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(data, "sourceUrl") ? { sourceUrl: data.sourceUrl } : {}),
    },
  });

  return NextResponse.json({ event: updatedEvent });
}

// Allows owners, moderators, and admins to remove a timeline event.
export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const parsedParams = vehicleIdParamsSchema.safeParse({ id: params.id });
  if (!parsedParams.success || !params.eventId) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const access = await resolveVehicleManager(parsedParams.data.id, auth.userId);
  if (!access.ok) return access.response;

  const event = await findEventOfVehicle(access.vehicle.id, params.eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.vehicleEvent.delete({ where: { id: params.eventId } });
  return new NextResponse(null, { status: 204 });
}
