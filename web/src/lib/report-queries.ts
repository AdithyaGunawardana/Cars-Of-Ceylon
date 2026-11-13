import type { Prisma } from "@prisma/client";
import { listReportsQuerySchema } from "@/lib/contracts/report-contracts";
import { prisma } from "@/lib/prisma";

export type ReportListQuery = ReturnType<typeof listReportsQuerySchema.parse>;

// Lenient parsing for page URLs: invalid or missing values fall back to defaults instead of erroring.
export function parseReportListParams(raw: Record<string, string | string[] | undefined>): ReportListQuery {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (typeof single === "string" && single.trim() !== "") cleaned[key] = single.trim();
  }
  const strict = listReportsQuerySchema.safeParse(cleaned);
  if (strict.success) return strict.data;

  // Retry per field so one bad value does not discard the others.
  const status = listReportsQuerySchema.shape.status.safeParse(cleaned.status);
  const page = listReportsQuerySchema.shape.page.safeParse(cleaned.page);
  const pageSize = listReportsQuerySchema.shape.pageSize.safeParse(cleaned.pageSize);
  return {
    status: status.success ? status.data : undefined,
    page: page.success ? page.data : 1,
    pageSize: pageSize.success ? pageSize.data : 20,
  };
}

const reportInclude = {
  vehicle: { select: { id: true, uniqueIdentifier: true, manufacturer: true, model: true, year: true } },
  createdBy: { select: { id: true, name: true } },
  moderatedBy: { select: { id: true, name: true } },
} satisfies Prisma.ReportInclude;

// Single implementation behind GET /api/reports and the moderation page.
export async function listReports(query: ReportListQuery) {
  const { status, page, pageSize } = query;
  const where: Prisma.ReportWhereInput = status ? { status } : {};

  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: reportInclude,
    }),
    prisma.report.count({ where }),
  ]);

  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}
