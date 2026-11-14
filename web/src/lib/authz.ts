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

// Public vehicles are visible to everyone. Private ones only to owner and moderation roles.
export function canViewVehicle(
  user: AuthzUser | null | undefined,
  vehicle: { visibility: "PUBLIC" | "PRIVATE"; createdByUserId: string },
) {
  if (vehicle.visibility === "PUBLIC") return true;
  return canManageVehicle(user, vehicle);
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
