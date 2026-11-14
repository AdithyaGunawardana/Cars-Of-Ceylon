import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const ROLE_REFRESH_MS = 5 * 60 * 1000;

const credentialSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

// Enable providers only when their env configuration exists, so local/dev can run with credentials only.
const providers = [
  Credentials({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(rawCredentials, req) {
      const parsed = credentialSchema.safeParse(rawCredentials);
      if (!parsed.success) {
        return null;
      }

      // Brute-force guard: 10 attempts / 15 min per email+IP and 30 / 15 min per IP.
      const ip = getClientIp({ get: (name) => (req?.headers as Record<string, string> | undefined)?.[name] ?? null });
      const windowMs = 15 * 60 * 1000;
      if (!rateLimit(`login:ip:${ip}`, 30, windowMs).allowed || !rateLimit(`login:${parsed.data.email}:${ip}`, 10, windowMs).allowed) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });

      if (!user?.passwordHash || user.bannedAt) {
        return null;
      }

      const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!isValid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  }),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
      ]
    : []),
  ...(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET
    ? [
    Apple({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
    }),
      ]
    : []),
];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    // Credentials provider requires JWT-backed sessions in NextAuth.
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      // Persist user id in JWT so session callback can expose it consistently.
      if (user?.id) {
        token.sub = user.id;
      }

      // Cache the role in the token (refreshed every 5 minutes) so pages/mobile can show role-aware UI
      // without a DB query per request. API routes still re-read the role from the DB for authorization.
      const now = Date.now();
      const stale = !token.roleCheckedAt || now - token.roleCheckedAt > ROLE_REFRESH_MS;
      if (token.sub && (user || stale || !token.role)) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.sub }, select: { role: true } });
        token.role = dbUser?.role ?? "USER";
        token.roleCheckedAt = now;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose user id in session payload for downstream ownership/permission checks.
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role ?? "USER";
      }
      return session;
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
