import { prisma } from "@/lib/prisma";

// Only vehicles anyone can see may feed public metadata (titles, descriptions, OG images, sitemap).
export const publiclyIndexable = { visibility: "PUBLIC", deletedAt: null, hiddenAt: null } as const;

export async function getPublicVehicleSeo(id: string) {
  return prisma.vehicle.findFirst({
    where: { id, ...publiclyIndexable },
    select: {
      id: true,
      manufacturer: true,
      model: true,
      year: true,
      description: true,
      uniqueIdentifier: true,
      _count: { select: { events: true, photos: true } },
    },
  });
}

export function truncate(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}...`;
}
