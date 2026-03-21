import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";

const createVehicleSchema = z.object({
  uniqueIdentifier: z.string().trim().min(2).max(40),
  licensePlate: z.string().trim().min(2).max(20).optional().nullable(),
  vin: z.string().trim().min(5).max(40).optional().nullable(),
  manufacturer: z.string().trim().min(2).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.number().int().min(1886).max(2100),
  description: z.string().trim().max(5000).optional().nullable(),
});

const listVehicleSchema = z.object({
  manufacturer: z.string().trim().min(1).max(80).optional(),
  model: z.string().trim().min(1).max(80).optional(),
  year: z.coerce.number().int().min(1886).max(2100).optional(),
  search: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = listVehicleSchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { manufacturer, model, year, search, page, pageSize } = parsed.data;

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
            { vin: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

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

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createVehicleSchema.safeParse(json);

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
