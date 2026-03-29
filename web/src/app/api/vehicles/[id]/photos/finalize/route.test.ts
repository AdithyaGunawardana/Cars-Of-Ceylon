import { beforeEach, describe, expect, it, vi } from "vitest";
import { photoApiErrorSchema, photoFinalizeSuccessSchema } from "@/lib/contracts/photo-contracts";

// Mock auth so tests can exercise access control deterministically.
vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    vehiclePhoto: { create: vi.fn() },
  },
}));

vi.mock("@/lib/upload-config", () => ({
  getUploadStorageConfig: vi.fn(),
  buildObjectUrl: vi.fn(),
}));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildObjectUrl, getUploadStorageConfig } from "@/lib/upload-config";
import { POST } from "./route";

describe("POST /api/vehicles/:id/photos/finalize", () => {
  beforeEach(() => {
    // Ensure each test starts with clean mock state.
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null as never);

    const request = new Request("http://localhost/api/vehicles/v1/photos/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storageKey: "vehicles/v1/f.png" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(photoApiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns 503 when upload storage is not configured", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u1" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);
    vi.mocked(getUploadStorageConfig).mockReturnValue(null);

    const request = new Request("http://localhost/api/vehicles/v1/photos/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storageKey: "vehicles/v1/f.png" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(photoApiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Upload storage is not configured. Set UPLOAD_S3_* environment variables.");
  });

  it("returns 400 for invalid photo payload", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);

    const request = new Request("http://localhost/api/vehicles/v1/photos/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storageKey: "" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(photoApiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Invalid photo data");
  });

  it("returns 403 when user is not allowed to contribute", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u2" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u1" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u2", role: "USER" } as never);

    const request = new Request("http://localhost/api/vehicles/v1/photos/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storageKey: "vehicles/v1/f.png" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(photoApiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Forbidden");
  });

  it("returns 404 when vehicle does not exist", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);

    const request = new Request("http://localhost/api/vehicles/v1/photos/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storageKey: "vehicles/v1/f.png" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(photoApiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Vehicle not found");
  });

  it("creates photo metadata for authorized contributor", async () => {
    // Finalization should persist metadata only after contributor checks pass.
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u1" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);
    vi.mocked(getUploadStorageConfig).mockReturnValue({
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      bucket: "cars-of-ceylon",
      accessKeyId: "minioadmin",
      secretAccessKey: "minioadmin",
      publicBaseUrl: "http://localhost:9000/cars-of-ceylon",
    } as never);
    vi.mocked(buildObjectUrl).mockReturnValue("http://localhost:9000/cars-of-ceylon/vehicles/v1/f.png");
    vi.mocked(prisma.vehiclePhoto.create).mockResolvedValue({ id: "p1" } as never);

    const request = new Request("http://localhost/api/vehicles/v1/photos/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storageKey: "vehicles/v1/f.png", caption: "test" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(photoFinalizeSuccessSchema.safeParse(payload).success).toBe(true);
    expect(payload.photo).toEqual({ id: "p1" });
    expect(prisma.vehiclePhoto.create).toHaveBeenCalledWith({
      data: {
        vehicleId: "v1",
        userId: "u1",
        url: "http://localhost:9000/cars-of-ceylon/vehicles/v1/f.png",
        storageKey: "vehicles/v1/f.png",
        caption: "test",
      },
    });
  });
});
