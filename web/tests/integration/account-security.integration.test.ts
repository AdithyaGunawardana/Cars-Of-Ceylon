import { HeadObjectCommand } from "@aws-sdk/client-s3";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { PATCH as patchAccount } from "@/app/api/account/route";
import { POST as avatarFinalize } from "@/app/api/account/avatar/finalize/route";
import { POST as avatarUploadUrl } from "@/app/api/account/avatar/upload-url/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as forgotPassword } from "@/app/api/auth/password/forgot/route";
import { POST as resetPassword } from "@/app/api/auth/password/reset/route";
import { POST as confirmEmail } from "@/app/api/auth/verify/confirm/route";
import { POST as sendVerification } from "@/app/api/auth/verify/send/route";
import { clearOutbox, outbox } from "@/lib/mailer";
import { resetRateLimits } from "@/lib/rate-limit";
import { findOrphanedObjects } from "@/lib/storage-cleanup";
import { actAs, call, createUser, db, resetState } from "../support/harness";
import { createTestS3Client, getTestS3Config } from "../support/test-env";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

function tokenFromMail(index = outbox.length - 1) {
  const match = /token=([^\s]+)/.exec(outbox[index]?.text ?? "");
  if (!match) throw new Error("No token link in the latest email");
  return decodeURIComponent(match[1]!);
}

async function withPassword(password = "old-password-1") {
  const user = await createUser();
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 4) } });
  return user;
}

describe("password reset (real Postgres)", () => {
  beforeEach(async () => {
    await resetState();
    clearOutbox();
  });

  it("answers identically for unknown addresses and sends nothing", async () => {
    const known = await withPassword();
    const unknown = await call(forgotPassword, { json: { email: "nobody@example.com" } });
    const existing = await call(forgotPassword, { json: { email: known.email } });
    expect(unknown.status).toBe(200);
    expect(existing.status).toBe(200);
    expect(unknown.body).toEqual(existing.body);
    expect(outbox.map((mail) => mail.to)).toEqual([known.email]);
    expect(outbox[0]!.text).toMatch(/\/reset-password\?token=/);
    expect((await call(forgotPassword, { json: { email: "not-an-email" } })).status).toBe(400);
  });

  it("does not email banned or password-less accounts, and rate limits per address", async () => {
    const banned = await withPassword();
    await db.user.update({ where: { id: banned.id }, data: { bannedAt: new Date() } });
    const social = await createUser();
    await db.user.update({ where: { id: social.id }, data: { passwordHash: null } });
    await call(forgotPassword, { json: { email: banned.email } });
    await call(forgotPassword, { json: { email: social.email } });
    expect(outbox).toHaveLength(0);

    const user = await withPassword();
    for (let i = 0; i < 5; i++) await call(forgotPassword, { json: { email: user.email } });
    // Only the first three requests for one address are delivered.
    expect(outbox).toHaveLength(3);
  });

  it("resets the password once, invalidates older sessions, and rejects bad or expired tokens", async () => {
    const user = await withPassword();
    await call(forgotPassword, { json: { email: user.email } });
    const token = tokenFromMail();

    // The raw token is never stored.
    expect(await db.verificationToken.count({ where: { token } })).toBe(0);

    expect((await call(resetPassword, { json: { token: "x".repeat(40), password: "brand-new-pass" } })).status).toBe(400);
    expect((await call(resetPassword, { json: { token, password: "short" } })).status).toBe(400);

    const reset = await call(resetPassword, { json: { token, password: "brand-new-pass" } });
    expect(reset.status).toBe(200);
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare("brand-new-pass", stored.passwordHash!)).toBe(true);
    expect(stored.emailVerified).not.toBeNull();
    expect(stored.sessionsValidAfter).not.toBeNull();

    // Single use.
    expect((await call(resetPassword, { json: { token, password: "another-pass-1" } })).status).toBe(400);

    // A session issued before the reset is rejected; a newer one works.
    actAs(user, stored.sessionsValidAfter!.getTime() - 60_000);
    expect((await call(patchAccount, { method: "PATCH", json: { name: "Old session" } })).status).toBe(401);
    actAs(user, stored.sessionsValidAfter!.getTime() + 60_000);
    expect((await call(patchAccount, { method: "PATCH", json: { name: "New session" } })).status).toBe(200);
    actAs(null);

    // Expired tokens are refused.
    await call(forgotPassword, { json: { email: user.email } });
    const expiring = tokenFromMail();
    await db.verificationToken.updateMany({ data: { expires: new Date(Date.now() - 1000) } });
    expect((await call(resetPassword, { json: { token: expiring, password: "brand-new-pass-2" } })).status).toBe(400);
  });

  it("only honours the newest token and keeps reset and verify tokens separate", async () => {
    const user = await withPassword();
    await call(forgotPassword, { json: { email: user.email } });
    const first = tokenFromMail();
    await call(forgotPassword, { json: { email: user.email } });
    const second = tokenFromMail();
    expect((await call(resetPassword, { json: { token: first, password: "brand-new-pass" } })).status).toBe(400);

    // A reset token cannot be used to verify an email, and vice versa.
    expect((await call(confirmEmail, { json: { token: second } })).status).toBe(400);
    // The failed cross-purpose attempt did not burn the token; it still works for its real purpose.
    expect((await call(resetPassword, { json: { token: second, password: "brand-new-pass" } })).status).toBe(200);
  });
});

describe("email verification (real Postgres)", () => {
  beforeEach(async () => {
    await resetState();
    clearOutbox();
  });

  it("sends a link on registration and confirms the address once", async () => {
    const created = await call(register, { json: { name: "New Member", email: "New.Member@Example.com", password: "password-123" } });
    expect(created.status).toBe(201);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe("new.member@example.com");

    const token = tokenFromMail();
    expect((await call(confirmEmail, { json: { token: "z".repeat(40) } })).status).toBe(400);
    const confirmed = await call(confirmEmail, { json: { token } });
    expect(confirmed.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { email: "new.member@example.com" } })).emailVerified).not.toBeNull();
    expect((await call(confirmEmail, { json: { token } })).status).toBe(400);
  });

  it("lets a signed-in user resend, rate limits, and refuses once verified", async () => {
    const user = await createUser();
    expect((await call(sendVerification, { json: {} })).status).toBe(401);

    actAs(user);
    expect((await call(sendVerification, { json: {} })).status).toBe(200);
    expect(outbox.at(-1)!.to).toBe(user.email);
    await call(sendVerification, { json: {} });
    await call(sendVerification, { json: {} });
    expect((await call(sendVerification, { json: {} })).status).toBe(429);

    resetRateLimits();
    await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    expect((await call(sendVerification, { json: {} })).status).toBe(409);
  });
});

describe("avatar upload (real Postgres + MinIO)", () => {
  beforeEach(resetState);

  async function head(key: string) {
    try {
      await createTestS3Client().send(new HeadObjectCommand({ Bucket: getTestS3Config().bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async function upload(type = "image/png", size = PNG.length) {
    const presign = await call(avatarUploadUrl, { json: { fileType: type, fileSize: size } });
    expect(presign.status).toBe(200);
    const put = await fetch(presign.body.uploadUrl, { method: "PUT", headers: { "content-type": type }, body: new Uint8Array(PNG) });
    expect(put.ok).toBe(true);
    return presign.body.storageKey as string;
  }

  it("validates requests, stores the avatar, and replaces or removes the previous object", async () => {
    const user = await createUser();
    expect((await call(avatarUploadUrl, { json: { fileType: "image/png", fileSize: 10 } })).status).toBe(401);

    actAs(user);
    expect((await call(avatarUploadUrl, { json: { fileType: "image/gif", fileSize: 10 } })).status).toBe(400);
    expect((await call(avatarUploadUrl, { json: { fileType: "image/png", fileSize: 6 * 1024 * 1024 } })).status).toBe(400);

    const first = await upload();
    expect(first).toMatch(new RegExp(`^avatars/${user.id}/`));
    const done = await call(avatarFinalize, { json: { storageKey: first } });
    expect(done.status).toBe(200);
    expect(done.body.image).toContain(first);
    expect(await db.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ image: done.body.image, avatarKey: first });

    const second = await upload();
    expect((await call(avatarFinalize, { json: { storageKey: second } })).status).toBe(200);
    expect(await head(first)).toBe(false);
    expect(await head(second)).toBe(true);

    // Switching to a plain link, or clearing, retires the stored object.
    expect((await call(patchAccount, { method: "PATCH", json: { image: "https://example.com/me.png" } })).status).toBe(200);
    expect(await head(second)).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).avatarKey).toBeNull();
  });

  it("refuses other users' keys, missing objects and wrong content", async () => {
    const user = await createUser();
    const other = await createUser();
    actAs(other);
    const othersKey = await upload();

    actAs(user);
    expect((await call(avatarFinalize, { json: { storageKey: othersKey } })).status).toBe(400);
    expect((await call(avatarFinalize, { json: { storageKey: `avatars/${user.id}/1-00000000-0000-0000-0000-000000000000.png` } })).status).toBe(400);
    expect((await call(avatarFinalize, { json: { storageKey: "../etc/passwd" } })).status).toBe(400);
  });

  it("reports unreferenced avatar objects as orphans for cleanup", async () => {
    const user = await createUser();
    actAs(user);
    const kept = await upload();
    await call(avatarFinalize, { json: { storageKey: kept } });
    const abandoned = await upload();

    const later = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const orphans = await findOrphanedObjects({ s3: createTestS3Client(), bucket: getTestS3Config().bucket, now: later });
    expect(orphans).toContain(abandoned);
    expect(orphans).not.toContain(kept);
  });
});
