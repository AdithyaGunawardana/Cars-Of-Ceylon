import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Single-use emailed tokens (password reset, email verification) stored in the Auth.js VerificationToken table.
// Only a SHA-256 hash is stored, so a database leak does not expose usable links.

export type TokenPurpose = "reset" | "verify";

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  reset: 60 * 60 * 1000,
  verify: 24 * 60 * 60 * 1000,
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function identifierFor(purpose: TokenPurpose, email: string) {
  return `${purpose}:${email.toLowerCase()}`;
}

// Issues a fresh token and invalidates any earlier one for the same purpose and email.
export async function issueToken(purpose: TokenPurpose, email: string) {
  const token = randomBytes(32).toString("base64url");
  const identifier = identifierFor(purpose, email);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: { identifier, token: hashToken(token), expires: new Date(Date.now() + TOKEN_TTL_MS[purpose]) },
    }),
  ]);
  return token;
}

// Atomically consumes a token: returns the email it was issued for, or null if it is unknown, expired or used.
export async function consumeToken(purpose: TokenPurpose, token: string): Promise<string | null> {
  const hashed = hashToken(token);
  const record = await prisma.verificationToken.findUnique({ where: { token: hashed } });
  if (!record || !record.identifier.startsWith(`${purpose}:`)) return null;

  // deleteMany reports how many rows it removed, so only one concurrent caller can win.
  const removed = await prisma.verificationToken.deleteMany({ where: { token: hashed } });
  if (removed.count === 0 || record.expires.getTime() < Date.now()) return null;

  return record.identifier.slice(purpose.length + 1);
}
