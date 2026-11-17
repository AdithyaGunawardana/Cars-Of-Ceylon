import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";
import { vehicleDetailSuccessSchema, updateVehicleSuccessSchema } from "@/lib/contracts/vehicle-contracts";

// Mock auth so tests can switch between owner, moderator, and unauthorized users.
vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    moderationLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DELETE, GET, PATCH } from "./route";

describe("/api/vehicles/:id route", () => {
  beforeEach(() => {
    // Clear all mock state between route scenarios.
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => fn(prisma)) as never);
  });

  describe("GET /api/vehicles/:id", () => {
    it("returns 404 for private vehicle when caller is not owner", async () => {
      vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({
        id: "v1",
        visibility: "PRIVATE",
        createdByUserId: "u-owner",
      } as never);
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u-other" } } as never);

      const response = await GET(new Request("http://localhost/api/vehicles/v1"), {
        params: Promise.resolve({ id: "v1" }),
      });
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Vehicle not found");
    });

    it.each([
      ["owner", { id: "u-owner", role: "USER" }],
      ["moderator", { id: "m1", role: "MODERATOR" }],
      ["admin", { id: "a1", role: "ADMIN" }],
    ])("returns private vehicle to %s", async (_label, viewer) => {
      vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({
        id: "v1",
        visibility: "PRIVATE",
        createdByUserId: "u-owner",
      } as never);
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: viewer.id } } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(viewer as never);

      const response = await GET(new Request("http://localhost/api/vehicles/v1"), {
        params: Promise.resolve({ id: "v1" }),
      });

      expect(response.status).toBe(200);
    });

    it("returns vehicle detail payload for public record", async () => {
      vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({
        id: "v1",
        visibility: "PUBLIC",
      } as never);

      const response = await GET(new Request("http://localhost/api/vehicles/v1"), {
        params: Promise.resolve({ id: "v1" }),
      });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(vehicleDetailSuccessSchema.safeParse(payload).success).toBe(true);
      expect(payload.vehicle.id).toBe("v1");
    });
  });

  describe("PATCH /api/vehicles/:id", () => {
    it("returns 401 when user is not authenticated", async () => {
      vi.mocked(getAuthSession).mockResolvedValue(null as never);

      const response = await PATCH(
        new Request("http://localhost/api/vehicles/v1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "Supra" }),
        }),
        { params: Promise.resolve({ id: "v1" }) },
      );
      const payload = await response.json();

      expect(response.status).toBe(401);
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Unauthorized");
    });

    it("returns 403 when user cannot manage vehicle", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u-other" } } as never);
      vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u-owner" } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-other", role: "USER" } as never);

      const response = await PATCH(
        new Request("http://localhost/api/vehicles/v1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "Supra" }),
        }),
        { params: Promise.resolve({ id: "v1" }) },
      );
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Forbidden");
    });

    it("returns 409 on duplicate unique field conflict", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u-owner" } } as never);
      vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u-owner" } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-owner", role: "USER" } as never);
      vi.mocked(prisma.vehicle.update).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("duplicate", {
          code: "P2002",
          clientVersion: "test",
        }),
      );

      const response = await PATCH(
        new Request("http://localhost/api/vehicles/v1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uniqueIdentifier: "DUP-1" }),
        }),
        { params: Promise.resolve({ id: "v1" }) },
      );
      const payload = await response.json();

      expect(response.status).toBe(409);
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    });

    it("updates vehicle for owner", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u-owner" } } as never);
      vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u-owner" } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-owner", role: "USER" } as never);
      vi.mocked(prisma.vehicle.update).mockResolvedValue({ id: "v1", model: "Supra" } as never);

      const response = await PATCH(
        new Request("http://localhost/api/vehicles/v1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "Supra" }),
        }),
        { params: Promise.resolve({ id: "v1" }) },
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(updateVehicleSuccessSchema.safeParse(payload).success).toBe(true);
      expect(payload.vehicle.id).toBe("v1");
    });
  });

  describe("DELETE /api/vehicles/:id", () => {
    it("returns 403 when user cannot delete vehicle", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u-other" } } as never);
      vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u-owner" } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-other", role: "USER" } as never);

      const response = await DELETE(new Request("http://localhost/api/vehicles/v1", { method: "DELETE" }), {
        params: Promise.resolve({ id: "v1" }),
      });
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(apiErrorSchema.safeParse(payload).success).toBe(true);
      expect(payload.error).toBe("Forbidden");
    });

    it("deletes vehicle for moderator", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u-mod" } } as never);
      vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u-owner" } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-mod", role: "MODERATOR" } as never);

      const response = await DELETE(new Request("http://localhost/api/vehicles/v1", { method: "DELETE" }), {
        params: Promise.resolve({ id: "v1" }),
      });

      expect(response.status).toBe(204);
      // Soft delete: the row is flagged, not removed, and a moderator's deletion is audited.
      expect(prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: "v1" },
        data: { deletedAt: expect.any(Date), deletedById: "u-mod" },
      });
      expect(prisma.moderationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: "VEHICLE_DELETE", targetType: "VEHICLE", targetId: "v1", actorId: "u-mod" }),
      });
    });
  });
});
