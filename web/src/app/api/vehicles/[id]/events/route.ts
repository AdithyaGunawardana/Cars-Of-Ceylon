import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const createEventSchema = z.object({
  type: z.enum([
    "CREATED",
    "OWNERSHIP_CHANGE",
    "SERVICE",
    "ACCIDENT",
    "MODIFICATION",
    "INSPECTION",
    "NOTE",
  ]),
  title: z.string().trim().min(2).max(140),
  details: z.string().trim().max(5000).optional().nullable(),
  occurredAt: z.string().datetime().optional().nullable(),
  sourceUrl: z.string().url().max(500).optional().nullable(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsedBody = createEventSchema.safeParse(json);
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
      occurredAt: parsedBody.data.occurredAt ? new Date(parsedBody.data.occurredAt) : null,
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
