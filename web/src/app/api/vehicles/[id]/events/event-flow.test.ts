import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createVehicleEventSuccessSchema,
  updateVehicleEventSuccessSchema,
} from "@/lib/contracts/vehicle-contracts";

vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

const eventsStore: Array<{
  id: string;
  vehicleId: string;
  userId: string;
  type: "CREATED" | "OWNERSHIP_CHANGE" | "SERVICE" | "ACCIDENT" | "MODIFICATION" | "INSPECTION" | "NOTE";
  title: string;
  details: string | null;
}> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    vehicleEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { POST as createEvent } from "./route";
import { DELETE as deleteEvent, PATCH as updateEvent } from "./[eventId]/route";

type CreateArgs = {
  data: {
    vehicleId?: string;
    userId?: string;
    type?: string;
    title?: string;
    details?: string | null;
  };
};

type WhereArgs = { where: { id: string } };

type PrismaMock<TArgs, TResult> = {
  mockImplementation: (fn: (args: TArgs) => Promise<TResult>) => void;
};

function setupFlowMocks() {
  // Single-user happy path: create -> update -> delete in one storyline.
  vi.mocked(getAuthSession)
    .mockResolvedValueOnce({ user: { id: "u-owner" } } as never)
    .mockResolvedValueOnce({ user: { id: "u-owner" } } as never)
    .mockResolvedValueOnce({ user: { id: "u-owner" } } as never);

  vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u-owner" } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-owner", role: "USER" } as never);

  // Prisma return types are strict; we cast mock handles for test ergonomics.
  const createMock = prisma.vehicleEvent.create as unknown as PrismaMock<CreateArgs, unknown>;
  const findUniqueMock = prisma.vehicleEvent.findUnique as unknown as PrismaMock<WhereArgs, unknown>;
  const updateMock = prisma.vehicleEvent.update as unknown as PrismaMock<
    { where: { id: string }; data: { title?: string } },
    unknown
  >;
  const deleteMock = prisma.vehicleEvent.delete as unknown as PrismaMock<WhereArgs, unknown>;

  createMock.mockImplementation(async (args) => {
    const next = {
      id: "e1",
      vehicleId: String(args.data.vehicleId ?? ""),
      userId: String(args.data.userId ?? ""),
      type: (args.data.type ?? "NOTE") as
        | "CREATED"
        | "OWNERSHIP_CHANGE"
        | "SERVICE"
        | "ACCIDENT"
        | "MODIFICATION"
        | "INSPECTION"
        | "NOTE",
      title: String(args.data.title ?? ""),
      details: args.data.details ? String(args.data.details) : null,
    };
    eventsStore.push(next);
    return next;
  });

  findUniqueMock.mockImplementation(async (args) => {
    return eventsStore.find((event) => event.id === args.where.id) ?? null;
  });

  updateMock.mockImplementation(async (args) => {
    const event = eventsStore.find((item) => item.id === args.where.id);
    if (!event) {
      return null as never;
    }

    event.title = String(args.data.title ?? event.title);
    return event;
  });

  deleteMock.mockImplementation(async (args) => {
    const index = eventsStore.findIndex((item) => item.id === args.where.id);
    if (index >= 0) {
      eventsStore.splice(index, 1);
    }
    return { id: args.where.id } as never;
  });
}

describe("Timeline event lifecycle integration-style test", () => {
  beforeEach(() => {
    eventsStore.length = 0;
    vi.clearAllMocks();
  });

  it("creates, updates, and deletes an event in one flow", async () => {
    // This confirms our contracts stay coherent across multiple route handlers.
    setupFlowMocks();

    const createRequest = new Request("http://localhost/api/vehicles/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "NOTE", title: "Initial note", details: "first" }),
    });

    const createResponse = await createEvent(createRequest, { params: Promise.resolve({ id: "v1" }) });
    const createPayload = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createVehicleEventSuccessSchema.safeParse(createPayload).success).toBe(true);
    expect(eventsStore).toHaveLength(1);

    const updateRequest = new Request("http://localhost/api/vehicles/v1/events/e1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated note" }),
    });

    const updateResponse = await updateEvent(updateRequest, {
      params: Promise.resolve({ id: "v1", eventId: "e1" }),
    });
    const updatePayload = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateVehicleEventSuccessSchema.safeParse(updatePayload).success).toBe(true);
    expect(eventsStore[0]?.title).toBe("Updated note");

    const deleteResponse = await deleteEvent(new Request("http://localhost/api/vehicles/v1/events/e1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "v1", eventId: "e1" }),
    });

    expect(deleteResponse.status).toBe(204);
    expect(eventsStore).toHaveLength(0);
  });
});
