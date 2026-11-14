import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { publiclyIndexable } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site";

// Query at request time: the build environment has no database.
export const dynamic = "force-dynamic";

const MAX_URLS = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const [vehicles, owners] = await Promise.all([
    prisma.vehicle.findMany({
      where: publiclyIndexable,
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: MAX_URLS,
    }),
    prisma.user.findMany({
      where: { bannedAt: null, vehicles: { some: publiclyIndexable } },
      select: { id: true, updatedAt: true },
      take: MAX_URLS,
    }),
  ]);

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/vehicles`, changeFrequency: "daily", priority: 0.9 },
    ...vehicles.map((v) => ({
      url: `${base}/vehicles/${v.id}`,
      lastModified: v.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...owners.map((u) => ({
      url: `${base}/users/${u.id}`,
      lastModified: u.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
