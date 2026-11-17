import { createHash, hkdfSync, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/prisma";

// Token sign-in for the mobile app.
//  - Access token: short-lived (15 min) signed JWT sent as `Authorization: Bearer ...`.
//  - Refresh token: random, opaque, single-use, stored hashed. Each use rotates it within a "family";
//    presenting an already-used token means it was copied, so the whole family is revoked.

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// A device must sign in again at least this often, however actively it refreshes.
export const FAMILY_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

const AUDIENCE = "cars-of-ceylon-mobile";
const ISSUER = "cars-of-ceylon";

export type MobileUser = { id: string; name: string | null; email: string; image: string | null; role: "USER" | "MODERATOR" | "ADMIN" };

function accessKey() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  // Derived key: a mobile access token can never be mistaken for (or forged from) a cookie session token.
  return new Uint8Array(hkdfSync("sha256", secret, "", "cars-of-ceylon/mobile-access/v1", 32));
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function signAccessToken(user: Pick<MobileUser, "id" | "role">) {
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAtSeconds)
    .sign(accessKey());
  return { token, expiresAt: new Date(expiresAtSeconds * 1000) };
}

export type AccessClaims = { userId: string; role: MobileUser["role"]; issuedAt: number; expiresAt: number };

// Returns null for anything that is not a valid, unexpired access token.
export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessKey(), { algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE });
    if (!payload.sub || typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    const role = payload.role === "ADMIN" || payload.role === "MODERATOR" ? payload.role : "USER";
    return { userId: payload.sub, role, issuedAt: payload.iat * 1000, expiresAt: payload.exp * 1000 };
  } catch {
    return null;
  }
}

// Reads `Authorization: Bearer <token>`. Returns undefined when no Bearer header is present, null when it is invalid.
export async function claimsFromAuthorization(header: string | null): Promise<AccessClaims | null | undefined> {
  if (!header) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return undefined;
  return verifyAccessToken(match[1]!);
}

export type TokenPair = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: MobileUser;
};

async function loadMobileUser(userId: string): Promise<MobileUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, role: true, bannedAt: true },
  });
  if (!user || user.bannedAt) return null;
  return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
}

async function buildPair(user: MobileUser, refreshToken: string, refreshExpiresAt: Date): Promise<TokenPair> {
  const access = await signAccessToken(user);
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshToken,
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    user,
  };
}

function newRefreshToken() {
  return randomBytes(32).toString("base64url");
}

// Starts a new device session (new token family) for an already-authenticated user.
export async function issueSession(userId: string, deviceName?: string | null): Promise<TokenPair | null> {
  const user = await loadMobileUser(userId);
  if (!user) return null;

  const refreshToken = newRefreshToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
  await prisma.mobileRefreshToken.create({
    data: {
      userId,
      familyId: randomBytes(16).toString("hex"),
      tokenHash: hashToken(refreshToken),
      deviceName: deviceName?.slice(0, 80) || null,
      familyStartedAt: now,
      expiresAt,
    },
  });
  return buildPair(user, refreshToken, expiresAt);
}

export async function revokeFamily(familyId: string) {
  await prisma.mobileRefreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export type RefreshResult = { ok: true; pair: TokenPair } | { ok: false; reason: "invalid" | "reuse" };

// Exchanges a refresh token for a new pair. The old token becomes unusable.
export async function rotateRefreshToken(presented: string): Promise<RefreshResult> {
  const record = await prisma.mobileRefreshToken.findUnique({ where: { tokenHash: hashToken(presented) } });
  if (!record) return { ok: false, reason: "invalid" };

  const now = Date.now();
  if (record.revokedAt || record.expiresAt.getTime() <= now || now - record.familyStartedAt.getTime() > FAMILY_MAX_AGE_MS) {
    return { ok: false, reason: "invalid" };
  }

  // Claim the token atomically: only one concurrent caller can flip usedAt from null.
  const claimed = await prisma.mobileRefreshToken.updateMany({
    where: { id: record.id, usedAt: null, revokedAt: null },
    data: { usedAt: new Date(now) },
  });
  if (claimed.count === 0) {
    // Already used: a stolen or replayed token. Sign the device out everywhere in this family.
    await revokeFamily(record.familyId);
    return { ok: false, reason: "reuse" };
  }

  const account = await prisma.user.findUnique({ where: { id: record.userId }, select: { sessionsValidAfter: true } });
  // A password reset signs out every earlier session, mobile included.
  if (account?.sessionsValidAfter && record.familyStartedAt.getTime() < account.sessionsValidAfter.getTime()) {
    await revokeFamily(record.familyId);
    return { ok: false, reason: "invalid" };
  }

  const user = await loadMobileUser(record.userId);
  if (!user) {
    await revokeFamily(record.familyId);
    return { ok: false, reason: "invalid" };
  }

  const refreshToken = newRefreshToken();
  const expiresAt = new Date(Math.min(now + REFRESH_TOKEN_TTL_MS, record.familyStartedAt.getTime() + FAMILY_MAX_AGE_MS));
  await prisma.mobileRefreshToken.create({
    data: {
      userId: record.userId,
      familyId: record.familyId,
      tokenHash: hashToken(refreshToken),
      deviceName: record.deviceName,
      familyStartedAt: record.familyStartedAt,
      expiresAt,
    },
  });
  return { ok: true, pair: await buildPair(user, refreshToken, expiresAt) };
}

// Sign out this device. Unknown tokens are ignored so the call is idempotent.
export async function revokeByRefreshToken(presented: string) {
  const record = await prisma.mobileRefreshToken.findUnique({ where: { tokenHash: hashToken(presented) }, select: { familyId: true } });
  if (record) await revokeFamily(record.familyId);
}

// Housekeeping for the cleanup job: drop tokens that can never be used again.
export async function purgeExpiredRefreshTokens(now = new Date()) {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.mobileRefreshToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
  });
  return result.count;
}
