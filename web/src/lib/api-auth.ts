import { NextResponse } from "next/server";
import { getAuthSession } from "@/auth";
import { canManageVehicle, isModerator, type AuthzUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

// Guard results: callers do `if (!guard.ok) return guard.response;` and then use the typed payload.
export type Guard<T> = ({ ok: true } & T) | { ok: false; response: NextResponse };

export function errorResponse(error: string, status: number, extra?: { headers?: HeadersInit }) {
  return NextResponse.json({ error }, { status, headers: extra?.headers });
}

// Step 1 of every protected route: require a signed-in, non-suspended account (401 / 403 otherwise).
// The ban flag is read from the database on every call so a ban takes effect immediately, even for live JWTs.
export async function requireSession(): Promise<Guard<{ userId: string }>> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return { ok: false, response: errorResponse("Unauthorized", 401) };
  }
  const account = await prisma.user.findUnique({ where: { id: session.user.id }, select: { bannedAt: true } });
  if (!account) {
    return { ok: false, response: errorResponse("Unauthorized", 401) };
  }
  if (account.bannedAt) {
    return { ok: false, response: errorResponse("Account suspended", 403) };
  }
  return { ok: true, userId: session.user.id };
}

// Authorization always uses the role stored in the database, never the (cached) session role.
export async function loadAuthzUser(userId: string): Promise<Guard<{ user: AuthzUser }>> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) {
    return { ok: false, response: errorResponse("Unauthorized", 401) };
  }
  return { ok: true, user };
}

// Moderator/admin only (403 otherwise).
export async function resolveModerator(userId: string): Promise<Guard<{ user: AuthzUser }>> {
  const loaded = await loadAuthzUser(userId);
  if (!loaded.ok) return loaded;
  if (!isModerator(loaded.user)) {
    return { ok: false, response: errorResponse("Forbidden", 403) };
  }
  return loaded;
}

// Vehicle owner, moderator or admin (404 missing vehicle, 401 missing user, 403 not allowed).
// Soft-deleted vehicles read as missing unless the caller opts in (restore flow).
export async function resolveVehicleManager(
  vehicleId: string,
  userId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<
  Guard<{
    vehicle: { id: string; createdByUserId: string; deletedAt: Date | null; deletedById: string | null };
    user: AuthzUser;
  }>
> {
  const [vehicle, user] = await Promise.all([
    prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, createdByUserId: true, deletedAt: true, deletedById: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
  ]);

  if (!vehicle || (vehicle.deletedAt && !options.includeDeleted)) {
    return { ok: false, response: errorResponse("Vehicle not found", 404) };
  }
  if (!user) {
    return { ok: false, response: errorResponse("Unauthorized", 401) };
  }
  if (!canManageVehicle(user, vehicle)) {
    return { ok: false, response: errorResponse("Forbidden", 403) };
  }
  return { ok: true, vehicle, user };
}
