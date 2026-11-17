import { beforeEach, describe, expect, it } from "vitest";
import { GET as getAccount } from "@/app/api/account/route";
import { GET as listDeleted } from "@/app/api/account/deleted-vehicles/route";
import { POST as restore } from "@/app/api/vehicles/[id]/restore/route";
import { actAs, call, createUser, createVehicle, db, resetState } from "../support/harness";

describe("account endpoints used by the mobile app (real Postgres)", () => {
  beforeEach(async () => {
    await resetState();
  });

  it("reports whether the email address is verified", async () => {
    const user = await createUser();
    actAs(user);
    expect((await call(getAccount)).body.user.emailVerified).toBe(false);

    await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    expect((await call(getAccount)).body.user.emailVerified).toBe(true);
  });

  it("lists only my own soft-deleted vehicles, flagging which ones I can restore", async () => {
    const me = await createUser();
    const moderator = await createUser("MODERATOR");
    const other = await createUser();

    const mine = await createVehicle(me, { manufacturer: "Morris" });
    const removedByModerator = await createVehicle(me, { manufacturer: "Rover" });
    const live = await createVehicle(me);
    const theirs = await createVehicle(other);
    await db.vehicle.update({ where: { id: mine.id }, data: { deletedAt: new Date(), deletedById: me.id } });
    await db.vehicle.update({ where: { id: removedByModerator.id }, data: { deletedAt: new Date(), deletedById: moderator.id } });
    await db.vehicle.update({ where: { id: theirs.id }, data: { deletedAt: new Date(), deletedById: other.id } });

    actAs(me);
    const res = await call(listDeleted);
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.items.map((item: { id: string }) => [item.id, item]));
    expect(Object.keys(byId).sort()).toEqual([mine.id, removedByModerator.id].sort());
    expect(byId[live.id]).toBeUndefined();
    expect(byId[mine.id].restorable).toBe(true);
    expect(byId[removedByModerator.id].restorable).toBe(false);
    const days = (new Date(byId[mine.id].purgeOn).getTime() - new Date(byId[mine.id].deletedAt).getTime()) / 86_400_000;
    expect(days).toBe(30);

    // The flag matches what the restore endpoint actually allows.
    expect((await call(restore, { params: { id: removedByModerator.id } })).status).toBe(403);
    expect((await call(restore, { params: { id: mine.id } })).status).toBe(200);
    expect((await call(listDeleted)).body.items.map((item: { id: string }) => item.id)).toEqual([removedByModerator.id]);
  });

  it("requires a signed-in user", async () => {
    expect((await call(listDeleted)).status).toBe(401);
  });
});
