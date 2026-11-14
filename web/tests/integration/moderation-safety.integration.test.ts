import { PutObjectCommand } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as createEvent } from "@/app/api/vehicles/[id]/events/route";
import { GET as getVehicle, DELETE as deleteVehicle } from "@/app/api/vehicles/[id]/route";
import { POST as restoreVehicle } from "@/app/api/vehicles/[id]/restore/route";
import { GET as listVehicles } from "@/app/api/vehicles/route";
import { GET as getLog } from "@/app/api/moderation/log/route";
import { POST as hideContent } from "@/app/api/moderation/content/route";
import { PATCH as banUser } from "@/app/api/moderation/users/[id]/route";
import { PATCH as patchReport } from "@/app/api/reports/[id]/route";
import { POST as createReport } from "@/app/api/reports/route";
import { PATCH as patchAccount } from "@/app/api/account/route";
import { GET as getProfile } from "@/app/api/users/[id]/route";
import { vehicleDetailResponseWireSchema } from "@/lib/contracts/response-schemas";
import { findOrphanedObjects, purgeDeletedVehicles, runStorageCleanup } from "@/lib/storage-cleanup";
import { actAs, call, createUser, createVehicle, db, expectSchema, resetState } from "../support/harness";
import { createTestS3Client, getTestS3Config } from "../support/test-env";

const s3 = createTestS3Client();
const bucket = getTestS3Config().bucket;

async function putObject(key: string) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from("x"), ContentType: "image/png" }));
}

describe("vehicle soft delete", () => {
  beforeEach(resetState);

  it("hides a deleted vehicle everywhere except from moderators and allows the owner to restore it", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const moderator = await createUser("MODERATOR");
    const vehicle = await createVehicle(owner);
    const params = { id: vehicle.id };

    actAs(owner);
    expect((await call(deleteVehicle, { method: "DELETE", params })).status).toBe(204);
    // Row is kept, flagged, and the owner's own deletion is not an audited moderation action.
    const row = await db.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.deletedById).toBe(owner.id);
    expect(await db.moderationLog.count()).toBe(0);

    // Gone for the owner, strangers and anonymous visitors; mutations also read as missing.
    for (const viewer of [owner, stranger, null]) {
      actAs(viewer);
      expect((await call(getVehicle, { params })).status).toBe(404);
      const list = await call(listVehicles, {});
      expect(list.body.items).toHaveLength(0);
    }
    actAs(owner);
    expect((await call(createEvent, { json: { type: "NOTE", title: "After delete" }, params })).status).toBe(404);
    expect((await call(deleteVehicle, { method: "DELETE", params })).status).toBe(404);

    // Moderators can still inspect it.
    actAs(moderator);
    expect((await call(getVehicle, { params })).status).toBe(200);

    // Strangers cannot restore; the owner can undo their own deletion.
    actAs(stranger);
    expect((await call(restoreVehicle, { json: {}, params })).status).toBe(403);
    actAs(owner);
    expect((await call(restoreVehicle, { json: {}, params })).status).toBe(200);
    expect((await call(restoreVehicle, { json: {}, params })).status).toBe(409);
    actAs(null);
    expect((await call(getVehicle, { params })).status).toBe(200);
  });

  it("audits moderator deletions and only lets moderators undo them", async () => {
    const owner = await createUser();
    const moderator = await createUser("MODERATOR");
    const vehicle = await createVehicle(owner);
    const params = { id: vehicle.id };

    actAs(moderator);
    expect((await call(deleteVehicle, { method: "DELETE", params })).status).toBe(204);

    // The owner cannot reverse a moderator's deletion.
    actAs(owner);
    expect((await call(restoreVehicle, { json: {}, params })).status).toBe(403);

    actAs(moderator);
    expect((await call(restoreVehicle, { json: {}, params })).status).toBe(200);

    const log = await db.moderationLog.findMany({ orderBy: { createdAt: "asc" } });
    expect(log.map((entry) => [entry.action, entry.targetType, entry.targetId, entry.actorId])).toEqual([
      ["VEHICLE_DELETE", "VEHICLE", vehicle.id, moderator.id],
      ["VEHICLE_RESTORE", "VEHICLE", vehicle.id, moderator.id],
    ]);
  });

  it("does not allow reporting a deleted vehicle", async () => {
    const owner = await createUser();
    const reporter = await createUser();
    const vehicle = await createVehicle(owner, { deletedAt: new Date(), deletedById: owner.id });
    actAs(reporter);
    expect((await call(createReport, { json: { vehicleId: vehicle.id, reason: "Looks fake to me" } })).status).toBe(404);
  });
});

describe("hiding content", () => {
  beforeEach(resetState);

  it("hides a vehicle from the public but not from its owner, and records why", async () => {
    const owner = await createUser();
    const moderator = await createUser("MODERATOR");
    const vehicle = await createVehicle(owner);
    const params = { id: vehicle.id };

    // Regular users cannot hide.
    actAs(owner);
    expect((await call(hideContent, { json: { targetType: "VEHICLE", targetId: vehicle.id, hidden: true, reason: "nope" } })).status).toBe(403);

    actAs(moderator);
    expect((await call(hideContent, { json: { targetType: "VEHICLE", targetId: vehicle.id, hidden: true } })).status).toBe(400);
    const hidden = await call(hideContent, { json: { targetType: "VEHICLE", targetId: vehicle.id, hidden: true, reason: "Copyrighted photos" } });
    expect(hidden.status).toBe(200);
    expect((await call(hideContent, { json: { targetType: "VEHICLE", targetId: vehicle.id, hidden: true, reason: "again" } })).status).toBe(409);

    actAs(null);
    expect((await call(getVehicle, { params })).status).toBe(404);
    expect((await call(listVehicles, {})).body.items).toHaveLength(0);

    actAs(owner);
    expect((await call(getVehicle, { params })).status).toBe(200);

    actAs(moderator);
    expect((await call(hideContent, { json: { targetType: "VEHICLE", targetId: vehicle.id, hidden: false, reason: "Resolved" } })).status).toBe(200);
    actAs(null);
    expect((await call(getVehicle, { params })).status).toBe(200);

    const log = await db.moderationLog.findMany({ orderBy: { createdAt: "asc" } });
    expect(log.map((entry) => [entry.action, entry.reason])).toEqual([
      ["CONTENT_HIDE", "Copyrighted photos"],
      ["CONTENT_UNHIDE", "Resolved"],
    ]);
  });

  it("filters hidden photos and events for the public but not for the owner", async () => {
    const owner = await createUser();
    const moderator = await createUser("MODERATOR");
    const vehicle = await createVehicle(owner);
    const params = { id: vehicle.id };
    const event = await db.vehicleEvent.create({ data: { vehicleId: vehicle.id, userId: owner.id, type: "NOTE", title: "Rude note" } });
    await db.vehicleEvent.create({ data: { vehicleId: vehicle.id, userId: owner.id, type: "NOTE", title: "Fine note" } });
    const photo = await db.vehiclePhoto.create({
      data: { vehicleId: vehicle.id, userId: owner.id, storageKey: `vehicles/${vehicle.id}/x.png`, url: "http://localhost/x.png" },
    });

    actAs(moderator);
    expect((await call(hideContent, { json: { targetType: "EVENT", targetId: event.id, hidden: true, reason: "Abusive" } })).status).toBe(200);
    expect((await call(hideContent, { json: { targetType: "PHOTO", targetId: photo.id, hidden: true, reason: "Not a car" } })).status).toBe(200);
    expect((await call(hideContent, { json: { targetType: "PHOTO", targetId: "missing", hidden: true, reason: "Not a car" } })).status).toBe(404);

    actAs(null);
    const publicView = expectSchema(vehicleDetailResponseWireSchema, (await call(getVehicle, { params })).body);
    expect(publicView.vehicle.events.map((e) => e.title)).toEqual(["Fine note"]);
    expect(publicView.vehicle.photos).toHaveLength(0);

    actAs(owner);
    const ownerView = expectSchema(vehicleDetailResponseWireSchema, (await call(getVehicle, { params })).body);
    expect(ownerView.vehicle.events).toHaveLength(2);
    expect(ownerView.vehicle.photos).toHaveLength(1);
    expect(ownerView.vehicle.photos[0]!.hiddenAt).not.toBeNull();
  });
});

describe("banning users", () => {
  beforeEach(resetState);

  it("blocks every protected call for a banned user and lifts on unban", async () => {
    const moderator = await createUser("MODERATOR");
    const member = await createUser();

    actAs(moderator);
    expect((await call(banUser, { method: "PATCH", json: { banned: true }, params: { id: member.id } })).status).toBe(400);
    const banned = await call(banUser, { method: "PATCH", json: { banned: true, reason: "Spam listings" }, params: { id: member.id } });
    expect(banned.status).toBe(200);
    expect((await call(banUser, { method: "PATCH", json: { banned: true, reason: "again" }, params: { id: member.id } })).status).toBe(409);

    // A live session for the banned user is rejected immediately.
    actAs(member);
    const blocked = await call(patchAccount, { method: "PATCH", json: { name: "Still here" } });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe("Account suspended");
    expect((await call(createReport, { json: { vehicleId: "x", reason: "whatever reason" } })).status).toBe(403);

    // Ban status is only visible to moderators.
    actAs(null);
    expect((await call(getProfile, { params: { id: member.id } })).body.user).not.toHaveProperty("bannedAt");
    actAs(moderator);
    expect((await call(getProfile, { params: { id: member.id } })).body.user.bannedAt).not.toBeNull();

    expect((await call(banUser, { method: "PATCH", json: { banned: false }, params: { id: member.id } })).status).toBe(200);
    actAs(member);
    expect((await call(patchAccount, { method: "PATCH", json: { name: "Back again" } })).status).toBe(200);

    const stored = await db.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(stored.bannedAt).toBeNull();
    expect((await db.moderationLog.findMany({ orderBy: { createdAt: "asc" } })).map((entry) => entry.action)).toEqual(["USER_BAN", "USER_UNBAN"]);
  });

  it("enforces who can ban whom", async () => {
    const admin = await createUser("ADMIN");
    const moderator = await createUser("MODERATOR");
    const otherModerator = await createUser("MODERATOR");
    const member = await createUser();
    const ban = (id: string) => call(banUser, { method: "PATCH", json: { banned: true, reason: "Policy violation" }, params: { id } });

    actAs(member);
    expect((await ban(moderator.id)).status).toBe(403);

    actAs(moderator);
    expect((await ban(moderator.id)).status).toBe(403); // self
    expect((await ban(admin.id)).status).toBe(403); // admins are protected
    expect((await ban(otherModerator.id)).status).toBe(403); // moderators cannot ban moderators
    expect((await ban("missing")).status).toBe(404);

    actAs(admin);
    expect((await ban(otherModerator.id)).status).toBe(200);
    expect((await ban(admin.id)).status).toBe(403);
  });
});

describe("moderation audit log", () => {
  beforeEach(resetState);

  it("is moderator-only, records report transitions, and supports filtering and pagination", async () => {
    const owner = await createUser();
    const reporter = await createUser();
    const moderator = await createUser("MODERATOR");
    const vehicle = await createVehicle(owner);

    actAs(reporter);
    const report = await call(createReport, { json: { vehicleId: vehicle.id, reason: "Timeline looks wrong" } });
    const params = { id: report.body.report.id as string };

    expect((await call(getLog)).status).toBe(403);

    actAs(moderator);
    await call(patchReport, { method: "PATCH", json: { status: "REVIEWING" }, params });
    await call(patchReport, { method: "PATCH", json: { status: "RESOLVED" }, params });
    // Rejected transition writes nothing.
    await call(patchReport, { method: "PATCH", json: { status: "REVIEWING" }, params });
    await call(hideContent, { json: { targetType: "VEHICLE", targetId: vehicle.id, hidden: true, reason: "Confirmed bad data" } });

    const all = await call(getLog);
    expect(all.status).toBe(200);
    expect(all.body.pagination.total).toBe(3);
    expect(all.body.items.map((i: { action: string }) => i.action)).toEqual(["CONTENT_HIDE", "REPORT_RESOLVED", "REPORT_REVIEWING"]);
    expect(all.body.items[0].actor).toEqual({ id: moderator.id, name: moderator.name });

    const reports = await call(getLog, { query: { targetType: "REPORT", pageSize: 1, page: 2 } });
    expect(reports.body.items).toHaveLength(1);
    expect(reports.body.pagination).toMatchObject({ total: 2, totalPages: 2, page: 2 });
    expect((await call(getLog, { query: { pageSize: 500 } })).status).toBe(400);
  });
});

describe("storage cleanup", () => {
  beforeEach(resetState);

  it("finds only old, unreferenced objects and deletes them when applied", async () => {
    const owner = await createUser();
    const vehicle = await createVehicle(owner);
    const prefix = `vehicles/${vehicle.id}/${owner.id}`;
    const keptKey = `${prefix}/kept-${Date.now()}.png`;
    const orphanKey = `${prefix}/orphan-${Date.now()}.png`;
    await putObject(keptKey);
    await putObject(orphanKey);
    await db.vehiclePhoto.create({ data: { vehicleId: vehicle.id, userId: owner.id, storageKey: keptKey, url: "http://localhost/kept.png" } });

    // Fresh uploads are inside the grace window, so nothing is an orphan yet.
    expect(await findOrphanedObjects({ s3, bucket })).not.toContain(orphanKey);

    const later = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const orphans = await findOrphanedObjects({ s3, bucket, now: later });
    expect(orphans).toContain(orphanKey);
    expect(orphans).not.toContain(keptKey);

    const dry = await runStorageCleanup({ s3, bucket, now: later });
    expect(dry).toMatchObject({ apply: false, deletedObjectCount: 0 });
    expect(await findOrphanedObjects({ s3, bucket, now: later })).toContain(orphanKey);

    const applied = await runStorageCleanup({ s3, bucket, now: later, apply: true });
    expect(applied.deletedObjectCount).toBeGreaterThanOrEqual(1);
    const after = await findOrphanedObjects({ s3, bucket, now: later });
    expect(after).not.toContain(orphanKey);
  });

  it("purges vehicles deleted longer than the retention window, with their objects", async () => {
    const owner = await createUser();
    const old = await createVehicle(owner, { deletedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), deletedById: owner.id });
    const recent = await createVehicle(owner, { deletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), deletedById: owner.id });
    const live = await createVehicle(owner);
    const oldKey = `vehicles/${old.id}/${owner.id}/old-${Date.now()}.png`;
    await putObject(oldKey);
    await db.vehiclePhoto.create({ data: { vehicleId: old.id, userId: owner.id, storageKey: oldKey, url: "http://localhost/old.png" } });
    await db.vehicleEvent.create({ data: { vehicleId: old.id, userId: owner.id, type: "NOTE", title: "gone soon" } });

    const dry = await purgeDeletedVehicles({ s3, bucket });
    expect(dry.vehicleIds).toEqual([old.id]);
    expect(await db.vehicle.count()).toBe(3);

    const purged = await purgeDeletedVehicles({ s3, bucket, apply: true });
    expect(purged).toMatchObject({ vehicleIds: [old.id], deletedObjects: 1 });
    expect(await db.vehicle.findMany({ select: { id: true }, orderBy: { id: "asc" } })).toEqual(
      [recent, live].map((v) => ({ id: v.id })).sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(await db.vehiclePhoto.count()).toBe(0);
    expect(await db.vehicleEvent.count()).toBe(0);
  });
});
