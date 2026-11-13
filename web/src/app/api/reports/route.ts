import { NextResponse } from "next/server";
import { loadAuthzUser, requireSession, resolveModerator } from "@/lib/api-auth";
import { listReportsQuerySchema, createReportRequestSchema } from "@/lib/contracts/report-contracts";
import { canViewVehicle } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const REPORT_LIMIT = 5;
const REPORT_WINDOW_MS = 15 * 60 * 1000;

// Allows authenticated users to file reports and moderators to review report queues.
export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const moderator = await resolveModerator(auth.userId);
  if (!moderator.ok) return moderator.response;

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
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  // Per-user throttle: 5 reports per 15 minutes.
  const limit = rateLimit(`report:${auth.userId}`, REPORT_LIMIT, REPORT_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many reports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsedBody = createReportRequestSchema.safeParse(payload);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid report data", details: parsedBody.error.flatten() }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: parsedBody.data.vehicleId },
    select: { id: true, visibility: true, createdByUserId: true },
  });

  // Private vehicles are invisible to non-owners, so reporting them must look like "not found".
  const loaded = await loadAuthzUser(auth.userId);
  if (!loaded.ok) return loaded.response;
  const reporter = loaded.user;

  if (!vehicle || !canViewVehicle(reporter, vehicle)) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  // One open report per user per vehicle prevents queue spam.
  const openReport = await prisma.report.findFirst({
    where: { vehicleId: vehicle.id, createdById: reporter.id, status: { in: ["PENDING", "REVIEWING"] } },
    select: { id: true },
  });
  if (openReport) {
    return NextResponse.json({ error: "You already have an open report for this vehicle." }, { status: 409 });
  }

  const report = await prisma.report.create({
    data: {
      vehicleId: vehicle.id,
      createdById: auth.userId,
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
