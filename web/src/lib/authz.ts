// Central permission rules so routes and pages cannot drift apart.
export type Role = "USER" | "MODERATOR" | "ADMIN";

export type AuthzUser = { id: string; role: Role };

export function isModerator(user: Pick<AuthzUser, "role"> | null | undefined) {
  return user?.role === "MODERATOR" || user?.role === "ADMIN";
}

// Owner, moderator, or admin may edit a vehicle and contribute events/photos to it.
export function canManageVehicle(user: AuthzUser | null | undefined, vehicle: { createdByUserId: string }) {
  if (!user) return false;
  return user.id === vehicle.createdByUserId || isModerator(user);
}

// Visibility rules, strictest first:
// - soft-deleted vehicles: moderators/admins only
// - hidden vehicles (moderated): owner and moderation roles
// - private vehicles: owner and moderation roles
// - everything else: public
export function canViewVehicle(
  user: AuthzUser | null | undefined,
  vehicle: {
    visibility: "PUBLIC" | "PRIVATE";
    createdByUserId: string;
    deletedAt?: Date | null;
    hiddenAt?: Date | null;
  },
) {
  if (vehicle.deletedAt) return isModerator(user);
  if (vehicle.hiddenAt) return canManageVehicle(user, vehicle);
  if (vehicle.visibility === "PUBLIC") return true;
  return canManageVehicle(user, vehicle);
}

// Whether `actor` may ban or unban `target`. Moderators handle regular users; only admins touch moderators;
// admins are never bannable through the API.
export function canBanUser(actor: AuthzUser, target: AuthzUser) {
  if (actor.id === target.id) return false;
  if (target.role === "ADMIN") return false;
  if (target.role === "MODERATOR") return actor.role === "ADMIN";
  return isModerator(actor);
}

// Report workflow: PENDING -> REVIEWING -> RESOLVED | REJECTED. Final states are terminal.
export const reportTransitions = {
  PENDING: ["REVIEWING"],
  REVIEWING: ["RESOLVED", "REJECTED"],
  RESOLVED: [],
  REJECTED: [],
} as const;

export type ReportStatusValue = keyof typeof reportTransitions;

export function canTransitionReport(from: ReportStatusValue, to: ReportStatusValue) {
  return (reportTransitions[from] as readonly ReportStatusValue[]).includes(to);
}
