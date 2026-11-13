import { DefaultSession } from "next-auth";

type AppRole = "USER" | "MODERATOR" | "ADMIN";

declare module "next-auth" {
  // Extend default session shape so server/client code can rely on user.id and a UI-only role hint.
  interface Session {
    user: {
      id: string;
      role: AppRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    roleCheckedAt?: number;
  }
}
