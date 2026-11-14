import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { createVehicleRequestSchema, vehicleListQuerySchema } from "@/lib/contracts/vehicle-contracts";
import { prisma } from "@/lib/prisma";
import { listPublicVehicles } from "@/lib/vehicle-queries";

// Lists public vehicles with filters/pagination.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = vehicleListQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  return NextResponse.json(await listPublicVehicles(parsed.data));
}

// Creates a new vehicle record for the authenticated contributor.
export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const json = await request.json().catch(() => null);
  const parsed = createVehicleRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid vehicle data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        ...parsed.data,
        attributes: parsed.data.attributes ?? undefined,
        createdByUserId: auth.userId,
        events: {
          // Every new vehicle starts with a CREATED event so timeline history is never empty.
          create: {
            userId: auth.userId,
            type: "CREATED",
            title: "Vehicle entry created",
            details: "Initial vehicle record added.",
          },
        },
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        _count: {
          select: { photos: true, events: true },
        },
      },
    });

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    // Unique constraint on uniqueIdentifier / licensePlate.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A vehicle with this unique identifier or license plate already exists." }, { status: 409 });
    }
    throw error;
  }
}
