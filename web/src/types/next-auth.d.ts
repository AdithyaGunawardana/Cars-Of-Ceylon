import { DefaultSession } from "next-auth";

declare module "next-auth" {
  // Extend default session shape so server/client code can rely on user.id.
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
