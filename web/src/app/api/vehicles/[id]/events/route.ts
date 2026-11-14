import { NextResponse } from "next/server";
import { requireSession, resolveVehicleManager } from "@/lib/api-auth";
import { createVehicleEventRequestSchema, vehicleIdParamsSchema } from "@/lib/contracts/vehicle-contracts";
import { prisma } from "@/lib/prisma";

// Creates a timeline event for a vehicle when the caller has contribution permissions.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const parsedParams = vehicleIdParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsedBody = createVehicleEventRequestSchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid event data", details: parsedBody.error.flatten() }, { status: 400 });
  }

  const access = await resolveVehicleManager(parsedParams.data.id, auth.userId);
  if (!access.ok) return access.response;
  const { vehicle, user: currentUser } = access;

  const event = await prisma.vehicleEvent.create({
    data: {
      vehicleId: vehicle.id,
      userId: currentUser.id,
      type: parsedBody.data.type,
      title: parsedBody.data.title,
      details: parsedBody.data.details,
      sourceUrl: parsedBody.data.sourceUrl,
      // Persist a real timestamp when provided; keep null when unknown.
      occurredAt: parsedBody.data.occurredAt ? new Date(parsedBody.data.occurredAt) : null,
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
