import { beforeEach, describe, expect, it, vi } from "vitest";
import { photoApiErrorSchema, photoUploadUrlSuccessSchema } from "@/lib/contracts/photo-contracts";

// Mock auth so each test controls authenticated vs unauthenticated behavior.
vi.mock("@/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
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

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildObjectUrl, getUploadStorageConfig } from "@/lib/upload-config";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { POST } from "./route";

describe("POST /api/vehicles/:id/photos/upload-url", () => {
  beforeEach(() => {
    // Reset call history and return values between scenarios.
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null as never);

    const request = new Request("http://localhost/api/vehicles/v1/photos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "a.png", fileType: "image/png", fileSize: 100 }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(photoApiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns 400 for unsupported file type", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);

    const request = new Request("http://localhost/api/vehicles/v1/photos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "a.gif", fileType: "image/gif", fileSize: 100 }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(photoApiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Unsupported file type");
  });

  it("returns 400 when file size exceeds max bytes", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u1" } } as never);

    const request = new Request("http://localhost/api/vehicles/v1/photos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "a.png", fileType: "image/png", fileSize: 10 * 1024 * 1024 + 1 }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(photoApiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("File too large. Max is 10485760 bytes.");
  });

  it("returns 403 when user is not allowed to contribute", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u2" } } as never);
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u1" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u2", role: "USER" } as never);

    const request = new Request("http://localhost/api/vehicles/v1/photos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "a.png", fileType: "image/png", fileSize: 100 }),
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

    const request = new Request("http://localhost/api/vehicles/v1/photos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "a.png", fileType: "image/png", fileSize: 100 }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(photoApiErrorSchema.safeParse(payload).success).toBe(true);
    expect(payload.error).toBe("Vehicle not found");
  });

  it("returns signed upload payload for authorized contributor", async () => {
    // Simulate an owner uploading a valid image and receiving a presigned PUT target.
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
    vi.mocked(getSignedUrl).mockResolvedValue("http://localhost:9000/signed-put-url" as never);
    vi.mocked(buildObjectUrl).mockReturnValue("http://localhost:9000/cars-of-ceylon/vehicles/v1/file.png");

    const request = new Request("http://localhost/api/vehicles/v1/photos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "a.png", fileType: "image/png", fileSize: 100 }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "v1" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(photoUploadUrlSuccessSchema.safeParse(payload).success).toBe(true);
    expect(payload.uploadUrl).toBe("http://localhost:9000/signed-put-url");
    expect(payload.publicUrl).toBe("http://localhost:9000/cars-of-ceylon/vehicles/v1/file.png");
    expect(payload.storageKey).toContain("vehicles/v1/");
    expect(payload.maxBytes).toBe(10 * 1024 * 1024);
  });
});
