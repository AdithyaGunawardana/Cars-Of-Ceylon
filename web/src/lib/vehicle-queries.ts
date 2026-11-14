import type { Prisma } from "@prisma/client";
import { vehicleListQuerySchema } from "@/lib/contracts/vehicle-contracts";
import { prisma } from "@/lib/prisma";

export type VehicleListQuery = ReturnType<typeof vehicleListQuerySchema.parse>;

// Browser forms submit empty strings for blank inputs; drop them so optional filters validate cleanly.
export function parseVehicleListParams(raw: Record<string, string | string[] | undefined>) {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (typeof single === "string" && single.trim() !== "") {
      cleaned[key] = single.trim();
    }
  }
  return vehicleListQuerySchema.safeParse(cleaned);
}

export function buildPublicVehicleWhere(query: VehicleListQuery): Prisma.VehicleWhereInput {
  const { manufacturer, model, year, search } = query;
  return {
    visibility: "PUBLIC",
    ...(manufacturer ? { manufacturer: { contains: manufacturer, mode: "insensitive" } } : {}),
    ...(model ? { model: { contains: model, mode: "insensitive" } } : {}),
    ...(year ? { year } : {}),
    ...(search
      ? {
          OR: [
            { uniqueIdentifier: { contains: search, mode: "insensitive" } },
            { licensePlate: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

// Single implementation behind both GET /api/vehicles and the /vehicles page so filters never drift.
export async function listPublicVehicles(query: VehicleListQuery) {
  const where = buildPublicVehicleWhere(query);
  const { page, pageSize } = query;

  const [items, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { photos: true, events: true } },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);

  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// Timeline order: real-world date first (newest on top, undated last), then record creation time.
export const eventOrderBy = [
  { occurredAt: { sort: "desc", nulls: "last" } },
  { createdAt: "desc" },
] satisfies Prisma.VehicleEventOrderByWithRelationInput[];

// Full vehicle record used by GET /api/vehicles/:id and the detail page.
export function getVehicleDetail(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      events: { orderBy: eventOrderBy },
      photos: { orderBy: { createdAt: "desc" } },
    },
  });
}
