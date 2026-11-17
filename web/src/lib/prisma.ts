import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
const adapter = connectionString ? new PrismaPg({ connectionString }) : undefined;

// Reuse a single Prisma client in development to avoid exhausting DB connections on hot reloads.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const runtimePrisma = adapter
  ? globalForPrisma.prisma ??
    new PrismaClient({
      // Keep verbose query logs in development only.
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    })
  : undefined;

const missingDatabaseUrlMessage =
  "DATABASE_URL is not configured. Prisma client is unavailable in this environment.";

export const prisma: PrismaClient =
  runtimePrisma ??
  (new Proxy(
    {},
    {
      get() {
        throw new Error(missingDatabaseUrlMessage);
      },
    },
  ) as PrismaClient);

if (process.env.NODE_ENV !== "production" && runtimePrisma) {
  globalForPrisma.prisma = runtimePrisma;
}
