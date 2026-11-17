import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const credentialSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

export type CredentialResult =
  | { status: "ok"; user: { id: string; email: string; name: string | null; image: string | null } }
  | { status: "invalid" }
  | { status: "throttled" };

// Shared by the web login form and the mobile token endpoint so both draw from the same brute-force budget:
// 10 attempts / 15 min per email+IP and 30 / 15 min per IP.
export async function verifyCredentials(rawCredentials: unknown, ip: string): Promise<CredentialResult> {
  const parsed = credentialSchema.safeParse(rawCredentials);
  if (!parsed.success) return { status: "invalid" };

  const windowMs = 15 * 60 * 1000;
  if (!rateLimit(`login:ip:${ip}`, 30, windowMs).allowed || !rateLimit(`login:${parsed.data.email}:${ip}`, 10, windowMs).allowed) {
    return { status: "throttled" };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash || user.bannedAt) return { status: "invalid" };

  const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!isValid) return { status: "invalid" };

  return { status: "ok", user: { id: user.id, email: user.email, name: user.name, image: user.image } };
}
