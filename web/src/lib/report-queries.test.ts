import { describe, expect, it, vi } from "vitest";

// Pure-function tests: keep Prisma (which requires DATABASE_URL) out of the import graph.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { parseReportListParams } from "@/lib/report-queries";

describe("parseReportListParams", () => {
  it("applies defaults for empty input", () => {
    expect(parseReportListParams({})).toEqual({ status: undefined, page: 1, pageSize: 20 });
  });

  it("accepts valid values", () => {
    expect(parseReportListParams({ status: "PENDING", page: "2", pageSize: "10" })).toEqual({
      status: "PENDING",
      page: 2,
      pageSize: 10,
    });
  });

  it("keeps valid fields when another field is invalid", () => {
    expect(parseReportListParams({ status: "NOPE", page: "3", pageSize: "9999" })).toEqual({
      status: undefined,
      page: 3,
      pageSize: 20,
    });
  });
});
