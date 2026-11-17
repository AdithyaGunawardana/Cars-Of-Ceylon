import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getAccount, PATCH as patchAccount } from "@/app/api/account/route";
import { POST as changePassword } from "@/app/api/account/password/route";
import { GET as getProfile } from "@/app/api/users/[id]/route";
import { accountResponseSchema } from "@/lib/contracts/user-contracts";
import { actAs, call, createUser, db, expectSchema, resetState } from "../support/harness";

describe("account self-service (real Postgres)", () => {
  beforeEach(resetState);

  it("requires a session", async () => {
    expect((await call(getAccount)).status).toBe(401);
    expect((await call(patchAccount, { method: "PATCH", json: { name: "Nope" } })).status).toBe(401);
    expect((await call(changePassword, { json: { currentPassword: "a", newPassword: "bbbbbbbb" } })).status).toBe(401);
  });

  it("edits name, bio and avatar, and the public profile reflects it", async () => {
    const user = await createUser();
    actAs(user);

    const res = await call(patchAccount, {
      method: "PATCH",
      json: { name: "Nimal Perera", bio: "Collector of Austins", image: "https://example.com/a.png" },
    });
    expect(res.status).toBe(200);
    expect(expectSchema(accountResponseSchema, res.body).user).toMatchObject({
      name: "Nimal Perera",
      bio: "Collector of Austins",
      image: "https://example.com/a.png",
    });

    // Partial update keeps bio; empty image clears the avatar.
    const second = await call(patchAccount, { method: "PATCH", json: { name: "Nimal P", image: "" } });
    expect(second.body.user).toMatchObject({ name: "Nimal P", bio: "Collector of Austins", image: null });

    actAs(null);
    const profile = await call(getProfile, { params: { id: user.id } });
    expect(profile.body.user.name).toBe("Nimal P");
    expect(profile.body.user.profile.bio).toBe("Collector of Austins");
    expect(profile.body.user.email).toBeNull();
  });

  it("rejects invalid input and non-editable fields", async () => {
    actAs(await createUser());
    for (const json of [
      {},
      { name: "x" },
      { image: "javascript:alert(1)" },
      { bio: "a".repeat(501) },
      { role: "ADMIN" },
      { email: "evil@example.com" },
    ]) {
      expect((await call(patchAccount, { method: "PATCH", json })).status, JSON.stringify(json)).toBe(400);
    }
  });

  it("changes the password only with the correct current password", async () => {
    const user = await createUser();
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash("old-password", 4) } });
    actAs(user);

    expect((await call(changePassword, { json: { currentPassword: "wrong-pass", newPassword: "new-password" } })).status).toBe(403);
    expect((await call(changePassword, { json: { currentPassword: "old-password", newPassword: "old-password" } })).status).toBe(400);
    expect((await call(changePassword, { json: { currentPassword: "old-password", newPassword: "short" } })).status).toBe(400);

    expect((await call(changePassword, { json: { currentPassword: "old-password", newPassword: "new-password" } })).status).toBe(200);
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare("new-password", stored.passwordHash!)).toBe(true);
  });

  it("rate limits password attempts", async () => {
    const user = await createUser();
    actAs(user);
    for (let i = 0; i < 5; i++) {
      await call(changePassword, { json: { currentPassword: "wrong-pass", newPassword: "new-password" } });
    }
    const blocked = await call(changePassword, { json: { currentPassword: "wrong-pass", newPassword: "new-password" } });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });
});
