import { prisma } from "@/lib/prisma";
import { publiclyIndexable } from "@/lib/seo";

export type FeedItem =
  | { kind: "VEHICLE"; id: string; createdAt: Date; actor: { id: string; name: string | null }; vehicle: FeedVehicle }
  | { kind: "EVENT"; id: string; createdAt: Date; actor: { id: string; name: string | null }; vehicle: FeedVehicle; title: string; eventType: string }
  | { kind: "PHOTO"; id: string; createdAt: Date; actor: { id: string; name: string | null }; vehicle: FeedVehicle; url: string; caption: string | null };

type FeedVehicle = { id: string; manufacturer: string; model: string; year: number };

const vehicleSelect = { id: true, manufacturer: true, model: true, year: true } as const;
const actorSelect = { id: true, name: true } as const;

// Recent public activity (new vehicles, timeline events, photos) from people the user follows, newest first.
// Each source is over-fetched to `page * pageSize` so the merged list can be sliced for any page.
export async function listFollowFeed(userId: string, page: number, pageSize: number) {
  const follows = await prisma.follow.findMany({ where: { followerId: userId }, select: { followeeId: true } });
  const followeeIds = follows.map((follow) => follow.followeeId);
  if (followeeIds.length === 0) {
    return { items: [] as FeedItem[], pagination: { page, pageSize, total: 0, totalPages: 0 }, followingCount: 0 };
  }

  // Banned authors are dropped, as is anything that is not publicly viewable.
  const author = { in: followeeIds };
  const authorFilter = { user: { bannedAt: null } };
  const take = page * pageSize;

  const [vehicles, events, photos, vehicleTotal, eventTotal, photoTotal] = await Promise.all([
    prisma.vehicle.findMany({
      where: { ...publiclyIndexable, createdByUserId: author, createdBy: { bannedAt: null } },
      orderBy: { createdAt: "desc" },
      take,
      select: { ...vehicleSelect, createdAt: true, createdBy: { select: actorSelect } },
    }),
    prisma.vehicleEvent.findMany({
      where: { userId: author, hiddenAt: null, type: { not: "CREATED" }, vehicle: publiclyIndexable, ...authorFilter },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, title: true, type: true, createdAt: true, user: { select: actorSelect }, vehicle: { select: vehicleSelect } },
    }),
    prisma.vehiclePhoto.findMany({
      where: { userId: author, hiddenAt: null, vehicle: publiclyIndexable, ...authorFilter },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, url: true, caption: true, createdAt: true, user: { select: actorSelect }, vehicle: { select: vehicleSelect } },
    }),
    prisma.vehicle.count({ where: { ...publiclyIndexable, createdByUserId: author, createdBy: { bannedAt: null } } }),
    prisma.vehicleEvent.count({ where: { userId: author, hiddenAt: null, type: { not: "CREATED" }, vehicle: publiclyIndexable, ...authorFilter } }),
    prisma.vehiclePhoto.count({ where: { userId: author, hiddenAt: null, vehicle: publiclyIndexable, ...authorFilter } }),
  ]);

  const merged: FeedItem[] = [
    ...vehicles.map((v): FeedItem => ({
      kind: "VEHICLE",
      id: v.id,
      createdAt: v.createdAt,
      actor: v.createdBy,
      vehicle: { id: v.id, manufacturer: v.manufacturer, model: v.model, year: v.year },
    })),
    ...events.map((e): FeedItem => ({
      kind: "EVENT",
      id: e.id,
      createdAt: e.createdAt,
      actor: e.user,
      vehicle: e.vehicle,
      title: e.title,
      eventType: e.type,
    })),
    ...photos.map((p): FeedItem => ({
      kind: "PHOTO",
      id: p.id,
      createdAt: p.createdAt,
      actor: p.user,
      vehicle: p.vehicle,
      url: p.url,
      caption: p.caption,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));

  const total = vehicleTotal + eventTotal + photoTotal;
  return {
    items: merged.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    followingCount: followeeIds.length,
  };
}
