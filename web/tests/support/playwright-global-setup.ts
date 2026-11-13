import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { ensureTestInfra, getTestDatabaseUrl, truncateAll } from "./test-env";

export const ADMIN_EMAIL = "e2e-admin@example.com";
export const ADMIN_PASSWORD = "E2eAdminPassw0rd!";

// Fresh database + a known admin account before the browser tests start.
export default async function globalSetup() {
  await ensureTestInfra();
  await truncateAll();

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getTestDatabaseUrl() }) });
  try {
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: "E2E Admin",
        role: "ADMIN",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
