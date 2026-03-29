import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentialSchema = z.object({
  email: z.string().email(),
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
    async authorize(rawCredentials) {
      const parsed = credentialSchema.safeParse(rawCredentials);
      if (!parsed.success) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });

      if (!user?.passwordHash) {
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
      return token;
    },
    async session({ session, token }) {
      // Expose user id in session payload for downstream ownership/permission checks.
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
