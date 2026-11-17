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
  const { manufacturer, model, year, yearFrom, yearTo, search, color, fuelType, transmission, bodyType } = query;

  // Structured attribute filters read the JSON column (see lib/vehicle-attributes.ts).
  const attributeFilters: Prisma.VehicleWhereInput[] = [
    ...(color ? [{ attributes: { path: ["color"], string_contains: color, mode: "insensitive" as const } }] : []),
    ...(fuelType ? [{ attributes: { path: ["fuelType"], equals: fuelType } }] : []),
    ...(transmission ? [{ attributes: { path: ["transmission"], equals: transmission } }] : []),
    ...(bodyType ? [{ attributes: { path: ["bodyType"], equals: bodyType } }] : []),
  ];

  return {
    visibility: "PUBLIC",
    deletedAt: null,
    hiddenAt: null,
    ...(manufacturer ? { manufacturer: { contains: manufacturer, mode: "insensitive" } } : {}),
    ...(model ? { model: { contains: model, mode: "insensitive" } } : {}),
    ...(year ? { year } : {}),
    ...(!year && (yearFrom || yearTo) ? { year: { ...(yearFrom ? { gte: yearFrom } : {}), ...(yearTo ? { lte: yearTo } : {}) } } : {}),
    ...(search
      ? {
          OR: [
            { uniqueIdentifier: { contains: search, mode: "insensitive" } },
            { licensePlate: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(attributeFilters.length > 0 ? { AND: attributeFilters } : {}),
  };
}

const MAX_SEARCH_RESULTS = 500;

function escapeLike(value: string) {
  // Postgres LIKE uses backslash as the default escape character.
  return value.replace(/[\\%_]/g, (char) => "\\" + char);
}

// Ranked full-text search over public vehicles. Combines Postgres full-text matching (stemming-free "simple"
// config, so plates and model codes tokenize predictably) with substring matching so partial words such as
// "coro" still find "Corolla". Timeline titles/details are searchable too.
export async function searchPublicVehicleIds(q: string): Promise<string[]> {
  const like = `%${escapeLike(q)}%`;
  // `d.doc` is one search document per vehicle: its own fields plus the text of its visible timeline events.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT v."id"
    FROM "Vehicle" v
    CROSS JOIN LATERAL (
      SELECT to_tsvector(
        'simple',
        v."manufacturer" || ' ' || v."model" || ' ' || v."uniqueIdentifier" || ' ' || coalesce(v."licensePlate", '') || ' ' || coalesce(v."description", '') || ' ' ||
        coalesce((SELECT string_agg(e."title" || ' ' || coalesce(e."details", ''), ' ') FROM "VehicleEvent" e WHERE e."vehicleId" = v."id" AND e."hiddenAt" IS NULL), '')
      ) AS doc
    ) d
    WHERE v."visibility" = 'PUBLIC' AND v."deletedAt" IS NULL AND v."hiddenAt" IS NULL
      AND (
        d.doc @@ websearch_to_tsquery('simple', ${q})
        OR v."manufacturer" ILIKE ${like} OR v."model" ILIKE ${like} OR v."uniqueIdentifier" ILIKE ${like}
        OR v."licensePlate" ILIKE ${like} OR v."description" ILIKE ${like}
        OR EXISTS (
          SELECT 1 FROM "VehicleEvent" e
          WHERE e."vehicleId" = v."id" AND e."hiddenAt" IS NULL AND (e."title" ILIKE ${like} OR e."details" ILIKE ${like})
        )
      )
    ORDER BY
      ts_rank(d.doc, websearch_to_tsquery('simple', ${q})) DESC,
      (v."manufacturer" ILIKE ${like} OR v."model" ILIKE ${like}) DESC,
      v."createdAt" DESC
    LIMIT ${MAX_SEARCH_RESULTS}`;
  return rows.map((row) => row.id);
}

const orderByForSort = {
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  year_desc: [{ year: "desc" }, { createdAt: "desc" }],
  year_asc: [{ year: "asc" }, { createdAt: "desc" }],
  name: [{ manufacturer: "asc" }, { model: "asc" }, { year: "asc" }],
} satisfies Record<string, Prisma.VehicleOrderByWithRelationInput[]>;

const listInclude = {
  createdBy: { select: { id: true, name: true } },
  _count: { select: { photos: true, events: true } },
} satisfies Prisma.VehicleInclude;

// Single implementation behind both GET /api/vehicles and the /vehicles page so filters never drift.
export async function listPublicVehicles(query: VehicleListQuery) {
  const where = buildPublicVehicleWhere(query);
  const { page, pageSize, q } = query;
  const sort = query.sort ?? (q ? "relevance" : "newest");
  const paging = { skip: (page - 1) * pageSize, take: pageSize };

  // Text search narrows to ranked ids first; the remaining filters still apply on top.
  const rankedIds = q ? await searchPublicVehicleIds(q) : null;
  const scopedWhere: Prisma.VehicleWhereInput = rankedIds ? { AND: [where, { id: { in: rankedIds } }] } : where;

  if (rankedIds && sort === "relevance") {
    const matching = await prisma.vehicle.findMany({ where: scopedWhere, select: { id: true } });
    const matchingIds = new Set(matching.map((row) => row.id));
    const ordered = rankedIds.filter((id) => matchingIds.has(id));
    const pageIds = ordered.slice(paging.skip, paging.skip + paging.take);
    const rows = await prisma.vehicle.findMany({ where: { id: { in: pageIds } }, include: listInclude });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = pageIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    return {
      items,
      pagination: { page, pageSize, total: ordered.length, totalPages: Math.ceil(ordered.length / pageSize) },
    };
  }

  const [items, total] = await Promise.all([
    prisma.vehicle.findMany({
      where: scopedWhere,
      orderBy: orderByForSort[sort === "relevance" ? "newest" : sort],
      ...paging,
      include: listInclude,
    }),
    prisma.vehicle.count({ where: scopedWhere }),
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

// Hidden photos/events are only shown to people who can manage the vehicle (owner, moderators, admins).
export function redactHiddenContent<T extends { photos: { hiddenAt: Date | null }[]; events: { hiddenAt: Date | null }[] }>(
  vehicle: T,
  canSeeHidden: boolean,
): T {
  if (canSeeHidden) return vehicle;
  return {
    ...vehicle,
    photos: vehicle.photos.filter((photo) => !photo.hiddenAt),
    events: vehicle.events.filter((event) => !event.hiddenAt),
  };
}
