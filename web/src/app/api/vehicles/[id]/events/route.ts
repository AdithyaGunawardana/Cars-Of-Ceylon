import { NextResponse } from "next/server";
import { getAuthSession } from "@/auth";
import { createVehicleEventRequestSchema, vehicleIdParamsSchema } from "@/lib/contracts/vehicle-contracts";
import { prisma } from "@/lib/prisma";

// Creates a timeline event for a vehicle when the caller has contribution permissions.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Owners and moderation roles can contribute timeline records.
  const canContribute =
    vehicle.createdByUserId === currentUser.id || currentUser.role === "MODERATOR" || currentUser.role === "ADMIN";

  if (!canContribute) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
