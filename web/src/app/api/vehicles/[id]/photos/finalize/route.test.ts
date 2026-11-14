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
  uploadRules: {
    maxBytes: 10 * 1024 * 1024,
    allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  getUploadStorageConfig: vi.fn(),
  buildObjectUrl: vi.fn(),
}));

// Replace only the S3 client factory; key validation stays real.
const s3Send = vi.fn();
vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  return { ...actual, createS3Client: () => ({ send: s3Send }) };
});

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildObjectUrl, getUploadStorageConfig } from "@/lib/upload-config";
import { POST } from "./route";

const VALID_KEY = "vehicles/v1/u1/1700000000000-123e4567-e89b-12d3-a456-426614174000.png";

function finalizeRequest(storageKey: string, caption?: string) {
  return new Request("http://localhost/api/vehicles/v1/photos/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storageKey, caption }),
  });
}

function mockContributor() {
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
  vi.mocked(buildObjectUrl).mockReturnValue(`http://localhost:9000/cars-of-ceylon/${VALID_KEY}`);
}

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
    // Finalization persists metadata only after permission, key, and object checks pass.
    mockContributor();
    s3Send.mockResolvedValue({ ContentLength: 1024, ContentType: "image/png" });
    vi.mocked(prisma.vehiclePhoto.create).mockResolvedValue({ id: "p1" } as never);

    const response = await POST(finalizeRequest(VALID_KEY, "test"), { params: Promise.resolve({ id: "v1" }) });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(photoFinalizeSuccessSchema.safeParse(payload).success).toBe(true);
    expect(payload.photo).toEqual({ id: "p1" });
    expect(prisma.vehiclePhoto.create).toHaveBeenCalledWith({
      data: {
        vehicleId: "v1",
        userId: "u1",
        url: `http://localhost:9000/cars-of-ceylon/${VALID_KEY}`,
        storageKey: VALID_KEY,
        caption: "test",
      },
    });
  });

  it.each([
    ["another vehicle", "vehicles/v2/u1/1700000000000-123e4567-e89b-12d3-a456-426614174000.png"],
    ["another user", "vehicles/v1/u2/1700000000000-123e4567-e89b-12d3-a456-426614174000.png"],
    ["path traversal", "vehicles/v1/u1/../u2/1700000000000-123e4567-e89b-12d3-a456-426614174000.png"],
    ["unexpected extension", "vehicles/v1/u1/1700000000000-123e4567-e89b-12d3-a456-426614174000.html"],
    ["unrelated object", "secrets/private.png"],
  ])("rejects storage key from %s with 400", async (_label, key) => {
    mockContributor();

    const response = await POST(finalizeRequest(key), { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid storage key");
    expect(s3Send).not.toHaveBeenCalled();
    expect(prisma.vehiclePhoto.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the object was never uploaded", async () => {
    mockContributor();
    s3Send.mockRejectedValue(new Error("NotFound"));

    const response = await POST(finalizeRequest(VALID_KEY), { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(400);
    expect(prisma.vehiclePhoto.create).not.toHaveBeenCalled();
  });

  it("deletes the object and returns 400 when stored size or type violates rules", async () => {
    mockContributor();
    s3Send
      .mockResolvedValueOnce({ ContentLength: 50 * 1024 * 1024, ContentType: "image/png" }) // HeadObject
      .mockResolvedValueOnce({}); // DeleteObject

    const response = await POST(finalizeRequest(VALID_KEY), { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(400);
    expect(s3Send).toHaveBeenCalledTimes(2);
    expect(prisma.vehiclePhoto.create).not.toHaveBeenCalled();
  });

  it("returns 409 when the upload was already finalized", async () => {
    mockContributor();
    s3Send.mockResolvedValue({ ContentLength: 1024, ContentType: "image/png" });
    vi.mocked(prisma.vehiclePhoto.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }),
    );

    const response = await POST(finalizeRequest(VALID_KEY), { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(409);
  });
});
