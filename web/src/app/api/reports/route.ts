import { NextResponse } from "next/server";
import { getAuthSession } from "@/auth";
import { listReportsQuerySchema, createReportRequestSchema } from "@/lib/contracts/report-contracts";
import { prisma } from "@/lib/prisma";

// Allows authenticated users to file reports and moderators to review report queues.
export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (currentUser.role !== "MODERATOR" && currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = listReportsQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { status, page, pageSize } = parsedQuery.data;
  const where = {
    ...(status ? { status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        vehicle: {
          select: {
            id: true,
            uniqueIdentifier: true,
            manufacturer: true,
            model: true,
            year: true,
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        moderatedBy: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.report.count({ where }),
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

  const payload = await request.json().catch(() => null);
  const parsedBody = createReportRequestSchema.safeParse(payload);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid report data", details: parsedBody.error.flatten() }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: parsedBody.data.vehicleId },
    select: { id: true },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const report = await prisma.report.create({
    data: {
      vehicleId: vehicle.id,
      createdById: session.user.id,
      reason: parsedBody.data.reason,
      status: "PENDING",
    },
    include: {
      vehicle: {
        select: {
          id: true,
          uniqueIdentifier: true,
          manufacturer: true,
          model: true,
          year: true,
        },
      },
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ report }, { status: 201 });
}
