import { describe, expect, it, vi } from "vitest";

// Pure-function tests: keep Prisma (which requires DATABASE_URL) out of the import graph.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { buildPublicVehicleWhere, parseVehicleListParams } from "@/lib/vehicle-queries";

describe("parseVehicleListParams", () => {
  it("drops blank form fields and applies defaults", () => {
    const result = parseVehicleListParams({ search: "", manufacturer: "  ", year: "", page: undefined });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ page: 1, pageSize: 20 });
  });

  it("trims and coerces values", () => {
    const result = parseVehicleListParams({ manufacturer: " Toyota ", year: "1998", page: "3" });
    expect(result.data).toMatchObject({ manufacturer: "Toyota", year: 1998, page: 3 });
  });

  it("fails on invalid values", () => {
    expect(parseVehicleListParams({ year: "abc" }).success).toBe(false);
    expect(parseVehicleListParams({ page: "0" }).success).toBe(false);
    expect(parseVehicleListParams({ pageSize: "500" }).success).toBe(false);
  });
});

describe("buildPublicVehicleWhere", () => {
  it("always restricts to PUBLIC and ORs search over id/plate", () => {
    const where = buildPublicVehicleWhere({ page: 1, pageSize: 20, search: "CAB" });
    expect(where.visibility).toBe("PUBLIC");
    expect(where.OR).toHaveLength(2);
  });
});
