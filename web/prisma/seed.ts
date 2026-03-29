import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@carsofceylon.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Upsert keeps seed re-runnable without creating duplicate admin users.
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Cars of Ceylon Admin",
      role: UserRole.ADMIN,
      passwordHash,
    },
    create: {
      name: "Cars of Ceylon Admin",
      email: adminEmail,
      role: UserRole.ADMIN,
      passwordHash,
    },
  });

  const sampleVehicles = [
    {
      uniqueIdentifier: "COC-0001",
      licensePlate: "WP-CAR-1001",
      manufacturer: "Toyota",
      model: "Corolla",
      year: 1998,
      description: "Preserved family sedan with complete service notes.",
    },
    {
      uniqueIdentifier: "COC-0002",
      licensePlate: "CP-CAR-2002",
      manufacturer: "Nissan",
      model: "Sunny",
      year: 2001,
      description: "Second owner record with import-era documentation.",
    },
  ];

  // Upsert sample records so repeated seeds update canonical demo data.
  for (const vehicle of sampleVehicles) {
    await prisma.vehicle.upsert({
      where: { uniqueIdentifier: vehicle.uniqueIdentifier },
      update: {
        ...vehicle,
        createdByUserId: admin.id,
      },
      create: {
        ...vehicle,
        createdByUserId: admin.id,
        events: {
          create: {
            userId: admin.id,
            type: "CREATED",
            title: "Vehicle entry created",
            details: "Seeded sample record for local development.",
          },
        },
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Admin email: ${adminEmail}`);
  console.log("Admin password: value from SEED_ADMIN_PASSWORD or default fallback");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
