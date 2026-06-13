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
  expires: string;
};

export type VehicleListItem = {
  id: string;
  uniqueIdentifier: string;
  licensePlate?: string | null;
  manufacturer: string;
  model: string;
  year: number;
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
  createdAt?: string;
  updatedAt?: string;
  user?: { id: string; name?: string | null };
};

export type VehiclePhoto = {
  id: string;
  url: string;
  storageKey?: string;
  caption?: string | null;
  createdAt?: string;
};

export type VehicleDetail = VehicleListItem & {
  description?: string | null;
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
