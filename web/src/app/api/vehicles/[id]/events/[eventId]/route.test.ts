import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";
import { updateVehicleEventSuccessSchema } from "@/lib/contracts/vehicle-contracts";

vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    vehicleEvent: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DELETE, PATCH } from "./route";

// This suite checks that only permitted users can mutate timeline events.
describe("PATCH/DELETE /api/vehicles/:id/events/:eventId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when patch caller is unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null as never);

    const response = await PATCH(
      new Request("http://localhost/api/vehicles/v1/events/e1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated title" }),
      }),
      { params: Promise.resolve({ id: "v1", eventId: "e1" }) },
    );

    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
  });

  it("returns 403 when caller lacks permission", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u-other" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u-owner" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-other", role: "USER" } as never);
    vi.mocked(prisma.vehicleEvent.findUnique).mockResolvedValue({ id: "e1", vehicleId: "v1" } as never);

    const response = await PATCH(
      new Request("http://localhost/api/vehicles/v1/events/e1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated title" }),
      }),
      { params: Promise.resolve({ id: "v1", eventId: "e1" }) },
    );

    const payload = await response.json();
    expect(response.status).toBe(403);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Forbidden");
  });

  it("updates event for owner", async () => {
    // Owner path: should pass permission checks and call Prisma update.
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u-owner" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u-owner" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-owner", role: "USER" } as never);
    vi.mocked(prisma.vehicleEvent.findUnique).mockResolvedValue({ id: "e1", vehicleId: "v1" } as never);
    vi.mocked(prisma.vehicleEvent.update).mockResolvedValue({ id: "e1", title: "Updated" } as never);

    const response = await PATCH(
      new Request("http://localhost/api/vehicles/v1/events/e1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ id: "v1", eventId: "e1" }) },
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(updateVehicleEventSuccessSchema.safeParse(payload).success).toBe(true);
    expect(prisma.vehicleEvent.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { title: "Updated" },
    });
  });

  it("returns 401 when delete caller is unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null as never);

    const response = await DELETE(new Request("http://localhost/api/vehicles/v1/events/e1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "v1", eventId: "e1" }),
    });

    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
  });

  it("deletes event for moderator", async () => {
    // Moderator path: can delete even when not the vehicle owner.
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u-mod" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u-owner" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-mod", role: "MODERATOR" } as never);
    vi.mocked(prisma.vehicleEvent.findUnique).mockResolvedValue({ id: "e1", vehicleId: "v1" } as never);

    const response = await DELETE(new Request("http://localhost/api/vehicles/v1/events/e1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "v1", eventId: "e1" }),
    });

    expect(response.status).toBe(204);
    expect(prisma.vehicleEvent.delete).toHaveBeenCalledWith({ where: { id: "e1" } });
  });
});
