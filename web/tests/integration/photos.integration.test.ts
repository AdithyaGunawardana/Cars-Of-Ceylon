import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as finalizePhoto } from "@/app/api/vehicles/[id]/photos/finalize/route";
import { PATCH as patchPhoto, DELETE as deletePhoto } from "@/app/api/vehicles/[id]/photos/[photoId]/route";
import { POST as requestUpload } from "@/app/api/vehicles/[id]/photos/upload-url/route";
import { GET as getVehicle } from "@/app/api/vehicles/[id]/route";
import { vehicleDetailResponseWireSchema } from "@/lib/contracts/response-schemas";
import { actAs, call, createUser, createVehicle, db, expectSchema, resetState } from "../support/harness";
import { createTestS3Client, getTestS3Config } from "../support/test-env";

// 1x1 transparent PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function objectExists(key: string) {
  try {
    await createTestS3Client().send(new HeadObjectCommand({ Bucket: getTestS3Config().bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

function put(url: string, body: Buffer, contentType: string) {
  return fetch(url, { method: "PUT", headers: { "content-type": contentType }, body: new Uint8Array(body) });
}

describe("photo upload lifecycle (real Postgres + MinIO)", () => {
  beforeEach(resetState);

  async function setup() {
    const owner = await createUser();
    const vehicle = await createVehicle(owner);
    actAs(owner);
    return { owner, vehicle, params: { id: vehicle.id } };
  }

  async function issueUpload(params: { id: string }, overrides: Record<string, unknown> = {}) {
    const res = await call(requestUpload, { json: { fileName: "front.png", fileType: "image/png", fileSize: PNG.length, ...overrides }, params });
    expect(res.status).toBe(200);
    return res.body as { uploadUrl: string; storageKey: string; publicUrl: string };
  }

  it("runs upload -> storage PUT -> finalize -> caption -> delete, including object cleanup", async () => {
    const { owner, vehicle, params } = await setup();
    const upload = await issueUpload(params);

    expect(upload.storageKey).toMatch(new RegExp(`^vehicles/${vehicle.id}/${owner.id}/\\d+-[0-9a-f-]{36}\\.png$`));
    expect((await put(upload.uploadUrl, PNG, "image/png")).ok).toBe(true);

    const finalized = await call(finalizePhoto, { json: { storageKey: upload.storageKey, caption: "Front" }, params });
    expect(finalized.status).toBe(201);
    const photoId = finalized.body.photo.id as string;

    // Replay is rejected and does not create a second row.
    expect((await call(finalizePhoto, { json: { storageKey: upload.storageKey }, params })).status).toBe(409);
    expect(await db.vehiclePhoto.count()).toBe(1);

    const detail = await call(getVehicle, { params });
    const parsed = expectSchema(vehicleDetailResponseWireSchema, detail.body);
    expect(parsed.vehicle.photos[0]).toMatchObject({ id: photoId, caption: "Front" });

    const photoParams = { id: vehicle.id, photoId };
    const edited = await call(patchPhoto, { method: "PATCH", json: { caption: "Front quarter" }, params: photoParams });
    expect(edited.body.photo.caption).toBe("Front quarter");

    expect(await objectExists(upload.storageKey)).toBe(true);
    expect((await call(deletePhoto, { method: "DELETE", params: photoParams })).status).toBe(204);
    expect(await db.vehiclePhoto.count()).toBe(0);
    expect(await objectExists(upload.storageKey)).toBe(false);
  });

  it("storage refuses uploads that differ from what was validated and signed", async () => {
    const { params } = await setup();
    const upload = await issueUpload(params);

    expect((await put(upload.uploadUrl, Buffer.concat([PNG, Buffer.alloc(4096)]), "image/png")).ok).toBe(false);
    expect((await put(upload.uploadUrl, PNG, "text/html")).ok).toBe(false);
    expect(await objectExists(upload.storageKey)).toBe(false);
  });

  it("rejects invalid upload requests", async () => {
    const { params } = await setup();
    const bad = (overrides: Record<string, unknown>) =>
      call(requestUpload, { json: { fileName: "x.png", fileType: "image/png", fileSize: 10, ...overrides }, params });

    expect((await bad({ fileType: "image/svg+xml" })).status).toBe(400);
    expect((await bad({ fileType: "text/html" })).status).toBe(400);
    expect((await bad({ fileSize: 11 * 1024 * 1024 })).status).toBe(400);
    expect((await bad({ fileSize: 0 })).status).toBe(400);

    // Hostile filenames never reach the storage key.
    const hostile = await issueUpload(params, { fileName: "../../evil.html", fileType: "image/jpeg" });
    expect(hostile.storageKey).toMatch(/\.jpg$/);
    expect(hostile.storageKey).not.toContain("evil");
  });

  it("finalize validates key ownership and that the object really exists", async () => {
    const { owner, vehicle, params } = await setup();
    const other = await createUser();
    const upload = await issueUpload(params);

    // Not uploaded yet.
    expect((await call(finalizePhoto, { json: { storageKey: upload.storageKey }, params })).status).toBe(400);

    // Keys for other vehicles/users/arbitrary objects are refused before touching storage.
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    for (const key of [
      `vehicles/other/${owner.id}/1-${uuid}.png`,
      `vehicles/${vehicle.id}/${other.id}/1-${uuid}.png`,
      `vehicles/${vehicle.id}/${owner.id}/../x/1-${uuid}.png`,
      `vehicles/${vehicle.id}/${owner.id}/1-${uuid}.html`,
      "secrets/private.png",
    ]) {
      expect((await call(finalizePhoto, { json: { storageKey: key }, params })).status).toBe(400);
    }

    // Another user cannot finalize this upload.
    await put(upload.uploadUrl, PNG, "image/png");
    actAs(other);
    expect((await call(finalizePhoto, { json: { storageKey: upload.storageKey }, params })).status).toBe(403);
  });

  it("restricts caption edit/delete to managers and scopes photos to their vehicle", async () => {
    const { owner, vehicle, params } = await setup();
    const stranger = await createUser();
    const moderator = await createUser("MODERATOR");
    const otherVehicle = await createVehicle(owner);

    const upload = await issueUpload(params);
    await put(upload.uploadUrl, PNG, "image/png");
    const photoId = (await call(finalizePhoto, { json: { storageKey: upload.storageKey }, params })).body.photo.id as string;
    const photoParams = { id: vehicle.id, photoId };

    actAs(stranger);
    expect((await call(patchPhoto, { method: "PATCH", json: { caption: "hax" }, params: photoParams })).status).toBe(403);
    expect((await call(deletePhoto, { method: "DELETE", params: photoParams })).status).toBe(403);

    actAs(owner);
    expect((await call(patchPhoto, { method: "PATCH", json: { caption: "x" }, params: { id: otherVehicle.id, photoId } })).status).toBe(404);
    expect((await call(patchPhoto, { method: "PATCH", json: { caption: "y".repeat(501) }, params: photoParams })).status).toBe(400);
    expect((await call(patchPhoto, { method: "PATCH", json: { caption: "   " }, params: photoParams })).body.photo.caption).toBeNull();

    actAs(moderator);
    expect((await call(deletePhoto, { method: "DELETE", params: photoParams })).status).toBe(204);
  });
});
