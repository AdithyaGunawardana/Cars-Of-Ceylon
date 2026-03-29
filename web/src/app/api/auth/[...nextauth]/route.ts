import NextAuth from "next-auth";
import { authOptions } from "@/auth";

// App Router exposes both GET and POST for the NextAuth handler on the same endpoint.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
