import { prisma } from "@/lib/prisma";

export async function loadUserProfile(profileUserId: string, viewerUserId?: string) {
  const [user, viewer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: profileUserId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        profile: true,
      },
    }),
    viewerUserId
      ? prisma.user.findUnique({
          where: { id: viewerUserId },
          select: { id: true, role: true },
        })
      : Promise.resolve(null),
  ]);

  if (!user) {
    return null;
  }

  const canSeePrivateVehicles = Boolean(
    viewer && (viewer.id === profileUserId || viewer.role === "MODERATOR" || viewer.role === "ADMIN"),
  );

  const [vehicles, followerCount, followingCount, followRecord] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        createdByUserId: profileUserId,
        ...(canSeePrivateVehicles ? {} : { visibility: "PUBLIC" as const }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { events: true, photos: true },
        },
      },
    }),
    prisma.follow.count({ where: { followeeId: profileUserId } }),
    prisma.follow.count({ where: { followerId: profileUserId } }),
    viewer && viewer.id !== profileUserId
      ? prisma.follow.findFirst({
          where: { followerId: viewer.id, followeeId: profileUserId },
        })
      : Promise.resolve(null),
  ]);

  return {
    user,
    stats: {
      vehicleCount: vehicles.length,
      followerCount,
      followingCount,
    },
    relationship: {
      isSelf: viewer?.id === profileUserId,
      isFollowing: Boolean(followRecord),
    },
    vehicles,
  };
}
