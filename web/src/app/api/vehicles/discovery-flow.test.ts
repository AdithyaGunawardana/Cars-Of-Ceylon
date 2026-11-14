import { beforeEach, describe, expect, it, vi } from "vitest";
import { vehicleListQuerySchema, vehicleListSuccessSchema } from "@/lib/contracts/vehicle-contracts";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

describe("mobile discovery contract for /api/vehicles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses discovery filters with the shared query schema", () => {
    const parsed = vehicleListQuerySchema.parse({
      manufacturer: "Toyota",
      model: "Corolla",
      year: "1999",
      search: "CAB-1234",
      page: "2",
      pageSize: "10",
    });

    expect(parsed).toEqual({
      manufacturer: "Toyota",
      model: "Corolla",
      year: 1999,
      search: "CAB-1234",
      page: 2,
      pageSize: 10,
    });
  });

  it("returns filtered public vehicles with pagination metadata", async () => {
    vi.mocked(prisma.vehicle.findMany).mockResolvedValue([
      {
        id: "v1",
        manufacturer: "Toyota",
        model: "Corolla",
        year: 1999,
        uniqueIdentifier: "ABC-1",
        licensePlate: "CAB-1234",
        createdBy: { id: "u1", name: "Owner" },
        _count: { photos: 1, events: 2 },
      },
    ] as never);
    vi.mocked(prisma.vehicle.count).mockResolvedValue(1 as never);

    const response = await GET(
      new Request("http://localhost/api/vehicles?manufacturer=Toyota&model=Corolla&year=1999&search=CAB-1234&page=2&pageSize=10"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(vehicleListSuccessSchema.safeParse(payload).success).toBe(true);
    expect(payload.pagination).toEqual({
      page: 2,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          visibility: "PUBLIC",
          manufacturer: { contains: "Toyota", mode: "insensitive" },
          model: { contains: "Corolla", mode: "insensitive" },
          year: 1999,
          OR: [
            { uniqueIdentifier: { contains: "CAB-1234", mode: "insensitive" } },
            { licensePlate: { contains: "CAB-1234", mode: "insensitive" } },
          ],
        },
        skip: 10,
        take: 10,
      }),
    );
  });
});
