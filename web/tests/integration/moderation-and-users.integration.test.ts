import { beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as listReports, POST as createReport } from "@/app/api/reports/route";
import { PATCH as patchReport } from "@/app/api/reports/[id]/route";
import { GET as getProfile } from "@/app/api/users/[id]/route";
import { DELETE as unfollow, POST as follow } from "@/app/api/users/[id]/follow/route";
import { profileWireSchema, reportListWireSchema, reportResponseWireSchema } from "@/lib/contracts/response-schemas";
import { actAs, call, createUser, createVehicle, db, expectSchema, resetState } from "../support/harness";

describe("moderation workflow (real Postgres)", () => {
  beforeEach(resetState);

  it("runs the full report lifecycle and records the moderator", async () => {
    const owner = await createUser();
    const reporter = await createUser();
    const moderator = await createUser("MODERATOR");
    const vehicle = await createVehicle(owner);

    actAs(reporter);
    const created = await call(createReport, { json: { vehicleId: vehicle.id, reason: "Timeline looks wrong" } });
    expect(created.status).toBe(201);
    const params = { id: created.body.report.id as string };

    // Duplicate open report is blocked.
    expect((await call(createReport, { json: { vehicleId: vehicle.id, reason: "Timeline looks wrong again" } })).status).toBe(409);

    // Reporters cannot moderate.
    expect((await call(patchReport, { method: "PATCH", json: { status: "REVIEWING" }, params })).status).toBe(403);

    actAs(moderator);
    expect((await call(patchReport, { method: "PATCH", json: { status: "RESOLVED" }, params })).status).toBe(409);
    const reviewing = await call(patchReport, { method: "PATCH", json: { status: "REVIEWING" }, params });
    const parsed = expectSchema(reportResponseWireSchema, reviewing.body);
    expect(parsed.report).toMatchObject({ status: "REVIEWING", moderatedById: moderator.id });
    expect(parsed.report.moderatedAt).not.toBeNull();

    expect((await call(patchReport, { method: "PATCH", json: { status: "REJECTED" }, params })).status).toBe(200);
    // Terminal.
    expect((await call(patchReport, { method: "PATCH", json: { status: "REVIEWING" }, params })).status).toBe(409);

    // After the report is closed the same user may report again.
    actAs(reporter);
    expect((await call(createReport, { json: { vehicleId: vehicle.id, reason: "New issue found" } })).status).toBe(201);
  });

  it("filters and paginates the moderator queue and hides it from regular users", async () => {
    const owner = await createUser();
    const moderator = await createUser("MODERATOR");
    const reporters = await Promise.all([createUser(), createUser(), createUser()]);
    const vehicle = await createVehicle(owner);

    for (const reporter of reporters) {
      actAs(reporter);
      await call(createReport, { json: { vehicleId: vehicle.id, reason: `Issue from ${reporter.id}` } });
    }

    actAs(reporters[0]!);
    expect((await call(listReports)).status).toBe(403);
    actAs(null);
    expect((await call(listReports)).status).toBe(401);

    actAs(moderator);
    const page1 = await call(listReports, { query: { pageSize: 2 } });
    const parsed = expectSchema(reportListWireSchema, page1.body);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.pagination).toMatchObject({ total: 3, totalPages: 2 });

    await call(patchReport, { method: "PATCH", json: { status: "REVIEWING" }, params: { id: parsed.items[0]!.id } });
    const reviewing = await call(listReports, { query: { status: "REVIEWING" } });
    expect(reviewing.body.items).toHaveLength(1);
  });

  it("hides private vehicles from reporters, throttles to 5 reports per window, and returns 429", async () => {
    const owner = await createUser();
    const reporter = await createUser();
    const privateVehicle = await createVehicle(owner, { visibility: "PRIVATE" });

    actAs(reporter);
    expect((await call(createReport, { json: { vehicleId: privateVehicle.id, reason: "Should be invisible" } })).status).toBe(404);

    const vehicles = await Promise.all(Array.from({ length: 6 }, () => createVehicle(owner)));
    const statuses: number[] = [];
    for (const vehicle of vehicles) {
      statuses.push((await call(createReport, { json: { vehicleId: vehicle.id, reason: "Spam spam spam" } })).status);
    }
    // 1 attempt was already spent on the private vehicle, so the window allows 4 more.
    expect(statuses.filter((s) => s === 201)).toHaveLength(4);
    const blocked = await call(createReport, { json: { vehicleId: vehicles[0]!.id, reason: "One more try" } });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("accounts and profiles (real Postgres)", () => {
  beforeEach(resetState);

  it("registers with normalized email, rejects case-variant duplicates, and throttles by IP", async () => {
    const ok = await call(register, { json: { name: "Jane", email: "  Jane@Example.COM ", password: "password123" }, headers: { "x-forwarded-for": "1.1.1.1" } });
    expect(ok.status).toBe(201);
    expect(ok.body.user.email).toBe("jane@example.com");
    expect(ok.body.user).not.toHaveProperty("passwordHash");

    const stored = await db.user.findUniqueOrThrow({ where: { email: "jane@example.com" } });
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);

    const dup = await call(register, { json: { name: "Jane 2", email: "JANE@example.com", password: "password123" }, headers: { "x-forwarded-for": "1.1.1.1" } });
    expect(dup.status).toBe(409);

    let throttled = false;
    for (let i = 0; i < 12 && !throttled; i += 1) {
      const res = await call(register, { json: { name: "Spam", email: `spam${i}@example.com`, password: "password123" }, headers: { "x-forwarded-for": "2.2.2.2" } });
      throttled = res.status === 429;
    }
    expect(throttled).toBe(true);
    // Other IPs are unaffected.
    expect((await call(register, { json: { name: "Fine", email: "fine@example.com", password: "password123" }, headers: { "x-forwarded-for": "3.3.3.3" } })).status).toBe(201);
  });

  it("only reveals email to the owner and admins, and exposes private vehicles only to allowed viewers", async () => {
    const owner = await createUser("USER", "Owner");
    const stranger = await createUser();
    const moderator = await createUser("MODERATOR");
    const admin = await createUser("ADMIN");
    await createVehicle(owner, { uniqueIdentifier: "IT-PUB" });
    await createVehicle(owner, { uniqueIdentifier: "IT-PRV", visibility: "PRIVATE" });
    const params = { id: owner.id };

    const view = async (who: { id: string } | null) => {
      actAs(who);
      const res = await call(getProfile, { params });
      expect(res.status).toBe(200);
      return expectSchema(profileWireSchema, res.body);
    };

    const anonymous = await view(null);
    expect(anonymous.user.email).toBeNull();
    expect(anonymous.vehicles.map((v) => v.uniqueIdentifier)).toEqual(["IT-PUB"]);

    expect((await view(stranger)).user.email).toBeNull();

    const asModerator = await view(moderator);
    expect(asModerator.user.email).toBeNull();
    expect(asModerator.vehicles).toHaveLength(2);

    expect((await view(owner)).user.email).toBe(owner.email);
    expect((await view(admin)).user.email).toBe(owner.email);

    actAs(null);
    expect((await call(getProfile, { params: { id: "does-not-exist" } })).status).toBe(404);
  });

  it("follows and unfollows idempotently and forbids self-follow", async () => {
    const alice = await createUser();
    const bob = await createUser();

    actAs(null);
    expect((await call(follow, { method: "POST", params: { id: bob.id } })).status).toBe(401);

    actAs(alice);
    expect((await call(follow, { method: "POST", params: { id: alice.id } })).status).toBe(400);
    expect((await call(follow, { method: "POST", params: { id: "missing" } })).status).toBe(404);

    expect((await call(follow, { method: "POST", params: { id: bob.id } })).body).toEqual({ following: true });
    expect((await call(follow, { method: "POST", params: { id: bob.id } })).body).toEqual({ following: true });
    expect(await db.follow.count()).toBe(1);

    const profile = expectSchema(profileWireSchema, (await call(getProfile, { params: { id: bob.id } })).body);
    expect(profile.relationship.isFollowing).toBe(true);
    expect(profile.stats.followerCount).toBe(1);

    expect((await call(unfollow, { method: "DELETE", params: { id: bob.id } })).body).toEqual({ following: false });
    expect(await db.follow.count()).toBe(0);
  });
});
