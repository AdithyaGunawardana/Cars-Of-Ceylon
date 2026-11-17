import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/mobile/auth/login/route";
import { POST as logout } from "@/app/api/mobile/auth/logout/route";
import { POST as refresh } from "@/app/api/mobile/auth/refresh/route";
import { requireSession } from "@/lib/api-auth";
import { claimsFromAuthorization, hashToken, purgeExpiredRefreshTokens, verifyAccessToken } from "@/lib/mobile-tokens";
import { actAs, call, createUser, db, resetState } from "../support/harness";

const PASSWORD = "correct-horse-1";

async function userWithPassword() {
  const user = await createUser();
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(PASSWORD, 4) } });
  return user;
}

async function signIn(email: string, deviceName = "Pixel test") {
  const res = await call(login, { json: { email, password: PASSWORD, deviceName } });
  expect(res.status).toBe(200);
  return res.body as { accessToken: string; refreshToken: string; user: { id: string; role: string }; accessTokenExpiresAt: string };
}

describe("mobile token sign-in (real Postgres)", () => {
  beforeEach(async () => {
    await resetState();
  });

  it("logs in with a password and returns a verifiable access token plus a hashed refresh token", async () => {
    const user = await userWithPassword();
    const pair = await signIn(user.email);

    expect(pair.user).toMatchObject({ id: user.id, role: "USER" });
    const claims = await verifyAccessToken(pair.accessToken);
    expect(claims?.userId).toBe(user.id);
    expect(claims!.expiresAt - claims!.issuedAt).toBe(15 * 60 * 1000);

    const stored = await db.mobileRefreshToken.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tokenHash).toBe(hashToken(pair.refreshToken));
    expect(stored[0]!.tokenHash).not.toBe(pair.refreshToken);
    expect(stored[0]!.deviceName).toBe("Pixel test");
  });

  it("rejects bad credentials, banned users and malformed bodies with generic errors", async () => {
    const user = await userWithPassword();
    expect((await call(login, { json: { email: user.email, password: "wrong-password" } })).status).toBe(401);
    expect((await call(login, { json: { email: "nobody@example.com", password: PASSWORD } })).status).toBe(401);
    expect((await call(login, { json: { nope: true } })).status).toBe(400);

    await db.user.update({ where: { id: user.id }, data: { bannedAt: new Date() } });
    expect((await call(login, { json: { email: user.email, password: PASSWORD } })).status).toBe(401);
  });

  it("throttles repeated failures per email and IP", async () => {
    const user = await userWithPassword();
    for (let i = 0; i < 10; i++) {
      expect((await call(login, { json: { email: user.email, password: "wrong-password" } })).status).toBe(401);
    }
    const blocked = await call(login, { json: { email: user.email, password: PASSWORD } });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("rotates refresh tokens and each token works only once", async () => {
    const user = await userWithPassword();
    const first = await signIn(user.email);

    const second = await call(refresh, { json: { refreshToken: first.refreshToken } });
    expect(second.status).toBe(200);
    expect(second.body.refreshToken).not.toBe(first.refreshToken);
    expect((await verifyAccessToken(second.body.accessToken))?.userId).toBe(user.id);

    const third = await call(refresh, { json: { refreshToken: second.body.refreshToken } });
    expect(third.status).toBe(200);
  });

  it("revokes the whole family when a used refresh token is replayed", async () => {
    const user = await userWithPassword();
    const first = await signIn(user.email);
    const second = await call(refresh, { json: { refreshToken: first.refreshToken } });
    expect(second.status).toBe(200);

    // The attacker (or a buggy client) replays the old token ...
    expect((await call(refresh, { json: { refreshToken: first.refreshToken } })).status).toBe(401);
    // ... which also kills the legitimately rotated token.
    expect((await call(refresh, { json: { refreshToken: second.body.refreshToken } })).status).toBe(401);
    expect(await db.mobileRefreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
  });

  it("keeps separate devices independent", async () => {
    const user = await userWithPassword();
    const phone = await signIn(user.email, "Phone");
    const tablet = await signIn(user.email, "Tablet");
    await call(logout, { json: { refreshToken: phone.refreshToken } });
    expect((await call(refresh, { json: { refreshToken: phone.refreshToken } })).status).toBe(401);
    expect((await call(refresh, { json: { refreshToken: tablet.refreshToken } })).status).toBe(200);
  });

  it("logout is idempotent and returns 204 even for unknown tokens", async () => {
    const user = await userWithPassword();
    const pair = await signIn(user.email);
    expect((await call(logout, { json: { refreshToken: pair.refreshToken } })).status).toBe(204);
    expect((await call(logout, { json: { refreshToken: pair.refreshToken } })).status).toBe(204);
    expect((await call(logout, { json: { refreshToken: "never-issued-token" } })).status).toBe(204);
    expect((await call(logout, { json: {} })).status).toBe(400);
  });

  it("refuses expired tokens, unknown tokens and banned accounts", async () => {
    const user = await userWithPassword();
    const pair = await signIn(user.email);
    expect((await call(refresh, { json: { refreshToken: "x".repeat(43) } })).status).toBe(401);

    await db.mobileRefreshToken.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call(refresh, { json: { refreshToken: pair.refreshToken } })).status).toBe(401);

    const other = await userWithPassword();
    const otherPair = await signIn(other.email);
    await db.user.update({ where: { id: other.id }, data: { bannedAt: new Date() } });
    expect((await call(refresh, { json: { refreshToken: otherPair.refreshToken } })).status).toBe(401);
  });

  it("a password reset signs out mobile sessions started before it", async () => {
    const user = await userWithPassword();
    const pair = await signIn(user.email);
    await db.user.update({ where: { id: user.id }, data: { sessionsValidAfter: new Date(Date.now() + 1000) } });
    expect((await call(refresh, { json: { refreshToken: pair.refreshToken } })).status).toBe(401);
  });

  it("enforces the 180-day device session cap", async () => {
    const user = await userWithPassword();
    const pair = await signIn(user.email);
    await db.mobileRefreshToken.updateMany({ where: { userId: user.id }, data: { familyStartedAt: new Date(Date.now() - 181 * 86_400_000) } });
    expect((await call(refresh, { json: { refreshToken: pair.refreshToken } })).status).toBe(401);
  });

  it("only one of two concurrent refreshes with the same token succeeds", async () => {
    const user = await userWithPassword();
    const pair = await signIn(user.email);
    const results = await Promise.all([
      call(refresh, { json: { refreshToken: pair.refreshToken } }),
      call(refresh, { json: { refreshToken: pair.refreshToken } }),
    ]);
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
  });

  it("purges tokens that expired or were revoked more than a week ago", async () => {
    const user = await userWithPassword();
    await signIn(user.email);
    const old = await signIn(user.email);
    await db.mobileRefreshToken.updateMany({ where: { tokenHash: hashToken(old.refreshToken) }, data: { expiresAt: new Date(Date.now() - 8 * 86_400_000) } });
    expect(await purgeExpiredRefreshTokens()).toBe(1);
    expect(await db.mobileRefreshToken.count()).toBe(1);
  });
});

describe("Bearer access tokens", () => {
  beforeEach(async () => {
    await resetState();
  });

  it("parses Authorization headers: absent/other schemes are ignored, bad tokens are null", async () => {
    const user = await userWithPassword();
    const pair = await signIn(user.email);
    expect(await claimsFromAuthorization(null)).toBeUndefined();
    expect(await claimsFromAuthorization("Basic abc")).toBeUndefined();
    expect(await claimsFromAuthorization("Bearer not-a-jwt")).toBeNull();
    expect((await claimsFromAuthorization(`Bearer ${pair.accessToken}`))?.userId).toBe(user.id);
    // A tampered signature is rejected.
    expect(await claimsFromAuthorization(`Bearer ${pair.accessToken.slice(0, -2)}xx`)).toBeNull();
  });

  it("ban and password reset apply to live access tokens through requireSession", async () => {
    const user = await userWithPassword();
    const pair = await signIn(user.email);
    const claims = (await verifyAccessToken(pair.accessToken))!;

    actAs({ id: user.id }, claims.issuedAt);
    expect((await requireSession()).ok).toBe(true);

    await db.user.update({ where: { id: user.id }, data: { sessionsValidAfter: new Date(claims.issuedAt + 5000) } });
    expect((await requireSession()).ok).toBe(false);

    await db.user.update({ where: { id: user.id }, data: { sessionsValidAfter: null, bannedAt: new Date() } });
    expect((await requireSession()).ok).toBe(false);
  });
});
