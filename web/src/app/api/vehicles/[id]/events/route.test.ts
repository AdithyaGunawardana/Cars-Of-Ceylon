import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";
import { createVehicleEventSuccessSchema } from "@/lib/contracts/vehicle-contracts";

// Mock auth so tests can drive authorized and unauthorized flows.
vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    vehicleEvent: { create: vi.fn() },
  },
}));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

describe("POST /api/vehicles/:id/events", () => {
  beforeEach(() => {
    // Clear call history and mocked values between tests.
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null as never);

    const request = new Request("http://localhost/api/vehicles/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "NOTE", title: "Added note" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid event payload", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);

    const request = new Request("http://localhost/api/vehicles/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "UNKNOWN", title: "x" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Invalid event data");
  });

  it("returns 404 when vehicle does not exist", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);

    const request = new Request("http://localhost/api/vehicles/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "NOTE", title: "Added note" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Vehicle not found");
  });

  it("returns 403 when user cannot contribute", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u2" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u1" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u2", role: "USER" } as never);

    const request = new Request("http://localhost/api/vehicles/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "NOTE", title: "Added note" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Forbidden");
  });

  it("creates event metadata for permitted user", async () => {
    // An owner/moderator/admin should be able to append timeline events.
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u1" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);
    vi.mocked(prisma.vehicleEvent.create).mockResolvedValue({ id: "e1" } as never);

    const request = new Request("http://localhost/api/vehicles/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "SERVICE",
        title: "Major service completed",
        details: "Changed oil and filters",
        occurredAt: "2026-03-01T10:00:00.000Z",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(createVehicleEventSuccessSchema.safeParse(payload).success).toBe(true);
    expect(payload.event).toEqual({ id: "e1" });
    expect(prisma.vehicleEvent.create).toHaveBeenCalledWith({
      data: {
        vehicleId: "v1",
        userId: "u1",
        type: "SERVICE",
        title: "Major service completed",
        details: "Changed oil and filters",
        sourceUrl: undefined,
        occurredAt: new Date("2026-03-01T10:00:00.000Z"),
      },
    });
  });
});
