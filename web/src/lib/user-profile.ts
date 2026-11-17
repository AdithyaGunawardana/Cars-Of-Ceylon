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
        bannedAt: true,
        role: true,
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

  // Email is private: only the account owner and admins may see it.
  const canSeeEmail = Boolean(viewer && (viewer.id === profileUserId || viewer.role === "ADMIN"));
  // Suspension status is moderator-only information.
  const { bannedAt, role, ...rest } = user;
  const isModeratorViewer = viewer?.role === "MODERATOR" || viewer?.role === "ADMIN";
  const publicUser = {
    ...rest,
    email: canSeeEmail ? user.email : null,
    ...(isModeratorViewer ? { bannedAt, role } : {}),
  };

  const canSeePrivateVehicles = Boolean(
    viewer && (viewer.id === profileUserId || viewer.role === "MODERATOR" || viewer.role === "ADMIN"),
  );

  const [vehicles, followerCount, followingCount, followRecord] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        createdByUserId: profileUserId,
        deletedAt: null,
        ...(canSeePrivateVehicles ? {} : { visibility: "PUBLIC" as const, hiddenAt: null }),
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
    user: publicUser,
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
