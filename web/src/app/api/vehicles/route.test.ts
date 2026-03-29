import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";
import { createVehicleSuccessSchema, vehicleListSuccessSchema } from "@/lib/contracts/vehicle-contracts";

// Mock auth so POST access control can be tested deterministically.
vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

describe("/api/vehicles route", () => {
  beforeEach(() => {
    // Reset mock state between scenarios.
    vi.clearAllMocks();
  });

  describe("GET /api/vehicles", () => {
    it("returns 400 for invalid query parameters", async () => {
      const request = new Request("http://localhost/api/vehicles?page=0");

      const response = await GET(request);

      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Invalid query parameters");
    });

    it("returns paginated public vehicles", async () => {
      vi.mocked(prisma.vehicle.findMany).mockResolvedValue([{ id: "v1" }] as never);
      vi.mocked(prisma.vehicle.count).mockResolvedValue(1 as never);

      const request = new Request(
        "http://localhost/api/vehicles?manufacturer=Toyota&search=ABC&page=1&pageSize=20",
      );

      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(vehicleListSuccessSchema.safeParse(payload).success).toBe(true);
      expect(payload.items).toEqual([{ id: "v1" }]);
      expect(payload.pagination).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
      expect(prisma.vehicle.findMany).toHaveBeenCalled();
      expect(prisma.vehicle.count).toHaveBeenCalled();
    });
  });

  describe("POST /api/vehicles", () => {
    it("returns 401 when user is not authenticated", async () => {
      vi.mocked(getAuthSession).mockResolvedValue(null as never);

      const request = new Request("http://localhost/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uniqueIdentifier: "ABC-1",
          manufacturer: "Toyota",
          model: "Corolla",
          year: 1999,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const payload = await response.json();
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Unauthorized");
    });

    it("returns 400 for invalid vehicle payload", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);

      const request = new Request("http://localhost/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manufacturer: "T" }),
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Invalid vehicle data");
    });

    it("creates a vehicle and seeded CREATED event for authenticated user", async () => {
      // Successful creation should attribute ownership and append initial timeline entry.
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
      vi.mocked(prisma.vehicle.create).mockResolvedValue({ id: "v1" } as never);

      const request = new Request("http://localhost/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uniqueIdentifier: "ABC-1",
          licensePlate: "CAB-1234",
          manufacturer: "Toyota",
          model: "Corolla",
          year: 1999,
          description: "sample",
        }),
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(createVehicleSuccessSchema.safeParse(payload).success).toBe(true);
      expect(payload.vehicle).toEqual({ id: "v1" });
      expect(prisma.vehicle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          uniqueIdentifier: "ABC-1",
          createdByUserId: "u1",
          events: {
            create: {
              userId: "u1",
              type: "CREATED",
              title: "Vehicle entry created",
              details: "Initial vehicle record added.",
            },
          },
        }),
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
          _count: {
            select: { photos: true, events: true },
          },
        },
      });
    });
  });
});
