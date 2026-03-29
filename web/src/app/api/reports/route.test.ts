import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";
import { createReportSuccessSchema, listReportsSuccessSchema } from "@/lib/contracts/report-contracts";

// Mock auth so tests can control permission paths.
vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    vehicle: { findUnique: vi.fn() },
    report: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

describe("/api/reports route", () => {
  beforeEach(() => {
    // Keep every scenario isolated by clearing mock state.
    vi.clearAllMocks();
  });

  describe("GET /api/reports", () => {
    it("returns 401 when user is not authenticated", async () => {
      vi.mocked(getAuthSession).mockResolvedValue(null as never);

      const response = await GET(new Request("http://localhost/api/reports"));
      const payload = await response.json();

      expect(response.status).toBe(401);
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Unauthorized");
    });

    it("returns 403 for non-moderator users", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);

      const response = await GET(new Request("http://localhost/api/reports"));
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Forbidden");
    });

    it("returns paginated report queue for moderators", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "m1" } } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "m1", role: "MODERATOR" } as never);
      vi.mocked(prisma.report.findMany).mockResolvedValue([{ id: "r1" }] as never);
      vi.mocked(prisma.report.count).mockResolvedValue(1 as never);

      const response = await GET(new Request("http://localhost/api/reports?status=PENDING&page=1&pageSize=20"));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(listReportsSuccessSchema.safeParse(payload).success).toBe(true);
      expect(payload.pagination).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
    });
  });

  describe("POST /api/reports", () => {
    it("returns 401 when user is not authenticated", async () => {
      vi.mocked(getAuthSession).mockResolvedValue(null as never);

      const request = new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: "v1", reason: "Fake listing" }),
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(401);
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Unauthorized");
    });

    it("returns 400 for invalid report payload", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);

      const request = new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: "v1", reason: "bad" }),
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Invalid report data");
    });

    it("returns 404 when vehicle does not exist", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
      vi.mocked(prisma.vehicle.findUnique).mockResolvedValue(null as never);

      const request = new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: "v1", reason: "This history appears incorrect." }),
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Vehicle not found");
    });

    it("returns 429 when report rate limit is exceeded", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
      vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1" } as never);
      vi.mocked(prisma.report.count).mockResolvedValue(5 as never);

      const request = new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: "v1", reason: "Timeline has incorrect ownership period." }),
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(429);
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Too many reports. Please wait before submitting again.");
    });

    it("creates a report for authenticated users", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
      vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1" } as never);
      vi.mocked(prisma.report.count).mockResolvedValue(0 as never);
      vi.mocked(prisma.report.create).mockResolvedValue({ id: "r1" } as never);

      const request = new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: "v1", reason: "This timeline includes unverified data." }),
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(createReportSuccessSchema.safeParse(payload).success).toBe(true);
      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            vehicleId: "v1",
            createdById: "u1",
            reason: "This timeline includes unverified data.",
            status: "PENDING",
          },
        }),
      );
    });
  });
});
