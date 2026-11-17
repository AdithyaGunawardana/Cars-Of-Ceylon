export type UserRole = "USER" | "MODERATOR" | "ADMIN";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: UserRole;
};

export type AuthSession = {
  user: SessionUser;
};

export type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

export const FUEL_TYPES = ["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "LPG", "OTHER"] as const;
export const TRANSMISSIONS = ["MANUAL", "AUTOMATIC", "OTHER"] as const;
export const BODY_TYPES = ["SEDAN", "HATCHBACK", "SUV", "WAGON", "COUPE", "CONVERTIBLE", "VAN", "PICKUP", "TRUCK", "MOTORCYCLE", "OTHER"] as const;
export const EVENT_TYPES = ["CREATED", "OWNERSHIP_CHANGE", "SERVICE", "ACCIDENT", "MODIFICATION", "INSPECTION", "NOTE"] as const;

export type VehicleAttributes = {
  color?: string;
  fuelType?: (typeof FUEL_TYPES)[number];
  transmission?: (typeof TRANSMISSIONS)[number];
  bodyType?: (typeof BODY_TYPES)[number];
  engineCc?: number;
  odometerKm?: number;
};

export type VehicleSort = "newest" | "oldest" | "year_desc" | "year_asc" | "name" | "relevance";

export type VehicleListItem = {
  id: string;
  uniqueIdentifier: string;
  licensePlate?: string | null;
  manufacturer: string;
  model: string;
  year: number;
  attributes?: VehicleAttributes | null;
  visibility?: "PUBLIC" | "PRIVATE";
  createdBy?: { id: string; name?: string | null };
  _count?: { events: number; photos: number };
};

export type VehicleEvent = {
  id: string;
  type: string;
  title: string;
  details?: string | null;
  occurredAt?: string | null;
  sourceUrl?: string | null;
  hiddenAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  user?: { id: string; name?: string | null };
};

export type VehiclePhoto = {
  id: string;
  url: string;
  storageKey?: string;
  caption?: string | null;
  hiddenAt?: string | null;
  createdAt?: string;
};

export type VehicleDetail = VehicleListItem & {
  description?: string | null;
  hiddenAt?: string | null;
  createdBy: { id: string; name?: string | null; email?: string | null };
  events: VehicleEvent[];
  photos: VehiclePhoto[];
};

export type Profile = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    profile?: unknown;
  };
  stats: {
    vehicleCount: number;
    followerCount: number;
    followingCount: number;
  };
  relationship: {
    isSelf: boolean;
    isFollowing: boolean;
  };
  vehicles: VehicleListItem[];
};

export type ReportItem = {
  id: string;
  reason: string;
  status: "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED";
  vehicle: {
    id: string;
    uniqueIdentifier: string;
    manufacturer: string;
    model: string;
    year: number;
  };
  createdBy?: { id: string; name?: string | null };
  moderatedBy?: { id: string; name?: string | null };
};

export type FeedVehicle = { id: string; manufacturer: string; model: string; year: number };
type FeedBase = { id: string; createdAt: string; actor: { id: string; name: string | null }; vehicle: FeedVehicle };
export type FeedItem =
  | (FeedBase & { kind: "VEHICLE" })
  | (FeedBase & { kind: "EVENT"; title: string; eventType: string })
  | (FeedBase & { kind: "PHOTO"; url: string; caption: string | null });

export type Account = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  bio: string | null;
  emailVerified: boolean;
};

export type DeletedVehicle = {
  id: string;
  manufacturer: string;
  model: string;
  year: number;
  uniqueIdentifier: string;
  deletedAt: string;
  restorable: boolean;
  purgeOn: string;
};

export type ModerationLogItem = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  createdAt: string;
  actor: { id: string; name?: string | null };
};
