import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";
import { updateVehicleEventRequestSchema } from "@/lib/contracts/vehicle-contracts";

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

describe("/api/vehicles/:id/events/:eventId route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid update payload", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u1" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);
    vi.mocked(prisma.vehicleEvent.findUnique).mockResolvedValue({ id: "e1", vehicleId: "v1" } as never);

    const response = await PATCH(
      new Request("http://localhost/api/vehicles/v1/events/e1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "v1", eventId: "e1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Invalid event data");
  });

  it("updates an event for an authorized owner", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u1" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);
    vi.mocked(prisma.vehicleEvent.findUnique).mockResolvedValue({ id: "e1", vehicleId: "v1" } as never);
    vi.mocked(prisma.vehicleEvent.update).mockResolvedValue({ id: "e1" } as never);

    const response = await PATCH(
      new Request("http://localhost/api/vehicles/v1/events/e1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated service" }),
      }),
      { params: Promise.resolve({ id: "v1", eventId: "e1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateVehicleEventRequestSchema.safeParse({ title: "Updated service" }).success).toBe(true);
    expect(payload.event.id).toBe("e1");
    expect(prisma.vehicleEvent.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: {
        title: "Updated service",
      },
    });
  });

  it("deletes an event for an authorized owner", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u1" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);
    vi.mocked(prisma.vehicleEvent.findUnique).mockResolvedValue({ id: "e1", vehicleId: "v1" } as never);

    const response = await DELETE(new Request("http://localhost/api/vehicles/v1/events/e1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "v1", eventId: "e1" }),
    });

    expect(response.status).toBe(204);
    expect(prisma.vehicleEvent.delete).toHaveBeenCalledWith({ where: { id: "e1" } });
  });
});
