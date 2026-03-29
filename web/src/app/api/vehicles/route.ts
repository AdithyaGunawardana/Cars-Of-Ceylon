import { NextResponse } from "next/server";
import { getAuthSession } from "@/auth";
import { createVehicleRequestSchema, vehicleListQuerySchema } from "@/lib/contracts/vehicle-contracts";
import { prisma } from "@/lib/prisma";

// Lists public vehicles with filters/pagination.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = vehicleListQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { manufacturer, model, year, search, page, pageSize } = parsed.data;

  // Build dynamic filters so list/search behavior stays consistent for web and future mobile clients.
  const where = {
    visibility: "PUBLIC" as const,
    ...(manufacturer ? { manufacturer: { contains: manufacturer, mode: "insensitive" as const } } : {}),
    ...(model ? { model: { contains: model, mode: "insensitive" as const } } : {}),
    ...(year ? { year } : {}),
    ...(search
      ? {
          OR: [
            { uniqueIdentifier: { contains: search, mode: "insensitive" as const } },
            { licensePlate: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // Fetch result page and total count together for efficient pagination metadata.
  const [items, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        _count: {
          select: { photos: true, events: true },
        },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);

  return NextResponse.json({
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

// Creates a new vehicle record for the authenticated contributor.
export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createVehicleRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid vehicle data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      ...parsed.data,
      createdByUserId: session.user.id,
      events: {
        // Every new vehicle starts with a CREATED event so timeline history is never empty.
        create: {
          userId: session.user.id,
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
}
