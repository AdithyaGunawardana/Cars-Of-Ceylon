import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession, type NextAuthOptions, type Session } from "next-auth";
import { headers } from "next/headers";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { verifyCredentials } from "@/lib/credentials";
import { claimsFromAuthorization } from "@/lib/mobile-tokens";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";

const ROLE_REFRESH_MS = 5 * 60 * 1000;

// Enable providers only when their env configuration exists, so local/dev can run with credentials only.
const providers = [
  Credentials({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(rawCredentials, req) {
      // Brute-force guard and password check are shared with the mobile token endpoint.
      const ip = getClientIp({ get: (name) => (req?.headers as Record<string, string> | undefined)?.[name] ?? null });
      const result = await verifyCredentials(rawCredentials, ip);
      if (result.status !== "ok") {
        return null;
      }
      const user = result.user;

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
      if (typeof token.iat === "number") {
        session.issuedAt = token.iat * 1000;
      }
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role ?? "USER";
      }
      return session;
    },
  },
};

// Signed-in identity for pages and API routes. Mobile clients send `Authorization: Bearer <access token>`;
// browsers use the NextAuth cookie. A Bearer header that is present but invalid is never "upgraded" to the cookie.
export async function getAuthSession(): Promise<Session | null> {
  let authorization: string | null = null;
  try {
    authorization = (await headers()).get("authorization");
  } catch {
    // Called outside a request scope; fall through to the cookie session.
  }

  const claims = await claimsFromAuthorization(authorization);
  if (claims === undefined) {
    return getServerSession(authOptions);
  }
  if (claims === null) {
    return null;
  }

  // Identity fields come from the database so profile changes show up without a new token.
  const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: { name: true, email: true, image: true } });
  if (!user) {
    return null;
  }
  return {
    user: { id: claims.userId, role: claims.role, name: user.name, email: user.email, image: user.image },
    expires: new Date(claims.expiresAt).toISOString(),
    issuedAt: claims.issuedAt,
  };
}
