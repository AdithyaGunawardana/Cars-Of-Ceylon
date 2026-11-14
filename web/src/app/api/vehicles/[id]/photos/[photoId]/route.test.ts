import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";
import { updatePhotoSuccessSchema } from "@/lib/contracts/photo-contracts";

vi.mock("@/auth", () => ({ getAuthSession: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    vehicle: { findUnique: vi.fn() },
    vehiclePhoto: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("@/lib/upload-config", () => ({ getUploadStorageConfig: vi.fn() }));

const s3Send = vi.fn();
vi.mock("@/lib/storage", () => ({ createS3Client: () => ({ send: s3Send }) }));

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUploadStorageConfig } from "@/lib/upload-config";
import { DELETE, PATCH } from "./route";

const ctx = { params: Promise.resolve({ id: "v1", photoId: "p1" }) };
const photoRow = { id: "p1", vehicleId: "v1", storageKey: "vehicles/v1/u1/k.png" };

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/vehicles/v1/photos/p1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function asUser(id: string, role: "USER" | "MODERATOR" | "ADMIN" = "USER") {
  vi.mocked(getAuthSession).mockResolvedValue({ user: { id } } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id, role } as never);
  vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ id: "v1", createdByUserId: "u1" } as never);
}

describe("/api/vehicles/:id/photos/:photoId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUploadStorageConfig).mockReturnValue({
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      bucket: "cars-of-ceylon",
      accessKeyId: "a",
      secretAccessKey: "b",
    } as never);
  });

  it("returns 401 when signed out", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null as never);
    const response = await PATCH(patchRequest({ caption: "x" }), ctx);
    expect(response.status).toBe(401);
    expect(apiErrorSchema.safeParse(await response.json()).success).toBe(true);
  });

  it("returns 404 when the photo belongs to a different vehicle", async () => {
    asUser("u1");
    vi.mocked(prisma.vehiclePhoto.findUnique).mockResolvedValue({ ...photoRow, vehicleId: "other" } as never);
    expect((await PATCH(patchRequest({ caption: "x" }), ctx)).status).toBe(404);
  });

  it("returns 403 for users who cannot manage the vehicle", async () => {
    asUser("u2");
    vi.mocked(prisma.vehiclePhoto.findUnique).mockResolvedValue(photoRow as never);
    expect((await PATCH(patchRequest({ caption: "x" }), ctx)).status).toBe(403);
    expect((await DELETE(new Request("http://localhost"), ctx)).status).toBe(403);
    expect(prisma.vehiclePhoto.update).not.toHaveBeenCalled();
    expect(prisma.vehiclePhoto.delete).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid caption payloads", async () => {
    asUser("u1");
    vi.mocked(prisma.vehiclePhoto.findUnique).mockResolvedValue(photoRow as never);
    expect((await PATCH(patchRequest({ caption: "x".repeat(501) }), ctx)).status).toBe(400);
    expect((await PATCH(patchRequest({}), ctx)).status).toBe(400);
  });

  it("updates the caption for the owner and clears blank captions to null", async () => {
    asUser("u1");
    vi.mocked(prisma.vehiclePhoto.findUnique).mockResolvedValue(photoRow as never);
    vi.mocked(prisma.vehiclePhoto.update).mockResolvedValue({ id: "p1", caption: "New" } as never);

    const response = await PATCH(patchRequest({ caption: "New" }), ctx);
    expect(response.status).toBe(200);
    expect(updatePhotoSuccessSchema.safeParse(await response.json()).success).toBe(true);
    expect(prisma.vehiclePhoto.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { caption: "New" } });

    await PATCH(patchRequest({ caption: "   " }), ctx);
    expect(prisma.vehiclePhoto.update).toHaveBeenLastCalledWith({ where: { id: "p1" }, data: { caption: null } });
  });

  it("lets a moderator delete: removes the row then the stored object", async () => {
    asUser("m1", "MODERATOR");
    vi.mocked(prisma.vehiclePhoto.findUnique).mockResolvedValue(photoRow as never);
    s3Send.mockResolvedValue({});

    const response = await DELETE(new Request("http://localhost"), ctx);

    expect(response.status).toBe(204);
    expect(prisma.vehiclePhoto.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(s3Send).toHaveBeenCalledTimes(1);
  });

  it("still succeeds when the stored object cannot be deleted", async () => {
    asUser("u1");
    vi.mocked(prisma.vehiclePhoto.findUnique).mockResolvedValue(photoRow as never);
    s3Send.mockRejectedValue(new Error("minio down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect((await DELETE(new Request("http://localhost"), ctx)).status).toBe(204);
    expect(prisma.vehiclePhoto.delete).toHaveBeenCalled();
  });
});
