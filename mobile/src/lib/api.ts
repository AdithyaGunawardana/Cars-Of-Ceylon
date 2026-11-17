import { request, signInWithPassword, signOutDevice, refreshSession } from "./api-client";
import type {
  Account,
  DeletedVehicle,
  FeedItem,
  ModerationLogItem,
  Pagination,
  Profile,
  ReportItem,
  SessionUser,
  VehicleAttributes,
  VehicleDetail,
  VehicleListItem,
  VehicleSort,
} from "./types";

// Thin, typed wrappers over the web API. Auth, token refresh and error mapping live in api-client.ts.

// ---- Auth -------------------------------------------------------------------------------------------------------

export { signInWithPassword, signOutDevice, refreshSession };

export async function registerAndSignIn(name: string, email: string, password: string): Promise<SessionUser> {
  await request("/api/auth/register", { json: { name, email, password } }, { auth: false });
  return signInWithPassword(email, password);
}

export function requestPasswordReset(email: string) {
  return request<{ ok: boolean }>("/api/auth/password/forgot", { json: { email } }, { auth: false });
}

// ---- Vehicles ---------------------------------------------------------------------------------------------------

export type VehicleFilters = {
  q?: string;
  search?: string;
  manufacturer?: string;
  model?: string;
  year?: string;
  yearFrom?: string;
  yearTo?: string;
  color?: string;
  fuelType?: string;
  transmission?: string;
  bodyType?: string;
  sort?: VehicleSort;
  page?: number;
  pageSize?: number;
};

export function listVehicles(filters: VehicleFilters) {
  return request<{ items: VehicleListItem[]; pagination: Pagination }>(
    "/api/vehicles",
    {},
    { query: { ...filters, page: filters.page ?? 1, pageSize: filters.pageSize ?? 10 } },
  );
}

export type VehicleInput = {
  uniqueIdentifier: string;
  licensePlate?: string | null;
  manufacturer: string;
  model: string;
  year: number;
  description?: string | null;
  attributes?: VehicleAttributes | null;
};

export function createVehicle(input: VehicleInput) {
  return request<{ vehicle: VehicleDetail }>("/api/vehicles", { json: input });
}

export function getVehicle(vehicleId: string) {
  return request<{ vehicle: VehicleDetail }>(`/api/vehicles/${vehicleId}`);
}

export function updateVehicle(vehicleId: string, payload: Partial<VehicleInput> & { visibility?: "PUBLIC" | "PRIVATE" }) {
  return request<{ vehicle: VehicleDetail }>(`/api/vehicles/${vehicleId}`, { method: "PATCH", json: payload });
}

export function deleteVehicle(vehicleId: string) {
  return request<void>(`/api/vehicles/${vehicleId}`, { method: "DELETE" });
}

export function restoreVehicle(vehicleId: string) {
  return request<{ restored: boolean }>(`/api/vehicles/${vehicleId}/restore`, { method: "POST" });
}

// ---- Timeline events --------------------------------------------------------------------------------------------

export type EventInput = {
  type: string;
  title: string;
  details?: string | null;
  occurredAt?: string | null;
  sourceUrl?: string | null;
};

export function createVehicleEvent(vehicleId: string, payload: EventInput) {
  return request<{ event: { id: string } }>(`/api/vehicles/${vehicleId}/events`, { json: payload });
}

export function updateVehicleEvent(vehicleId: string, eventId: string, payload: Partial<EventInput>) {
  return request<{ event: { id: string } }>(`/api/vehicles/${vehicleId}/events/${eventId}`, { method: "PATCH", json: payload });
}

export function deleteVehicleEvent(vehicleId: string, eventId: string) {
  return request<void>(`/api/vehicles/${vehicleId}/events/${eventId}`, { method: "DELETE" });
}

// ---- Photos -----------------------------------------------------------------------------------------------------

export function requestPhotoUpload(vehicleId: string, payload: { fileName: string; fileType: string; fileSize: number }) {
  return request<{ uploadUrl: string; storageKey: string; publicUrl: string; expiresInSeconds: number; maxBytes: number }>(
    `/api/vehicles/${vehicleId}/photos/upload-url`,
    { json: payload },
  );
}

export function finalizePhoto(vehicleId: string, payload: { storageKey: string; caption?: string | null }) {
  return request<{ photo: { id: string } }>(`/api/vehicles/${vehicleId}/photos/finalize`, { json: payload });
}

export function updatePhotoCaption(vehicleId: string, photoId: string, caption: string | null) {
  return request<{ photo: { id: string } }>(`/api/vehicles/${vehicleId}/photos/${photoId}`, { method: "PATCH", json: { caption } });
}

export function deletePhoto(vehicleId: string, photoId: string) {
  return request<void>(`/api/vehicles/${vehicleId}/photos/${photoId}`, { method: "DELETE" });
}

// ---- Reports ----------------------------------------------------------------------------------------------------

export function createReport(payload: { vehicleId: string; reason: string }) {
  return request<{ report: { id: string } }>("/api/reports", { json: payload });
}

export function listReports(params: { status?: string; page?: number; pageSize?: number }) {
  return request<{ items: ReportItem[]; pagination: Pagination }>(
    "/api/reports",
    {},
    { query: { status: params.status, page: params.page ?? 1, pageSize: params.pageSize ?? 10 } },
  );
}

export function updateReportStatus(reportId: string, status: "REVIEWING" | "RESOLVED" | "REJECTED") {
  return request<{ report: { id: string } }>(`/api/reports/${reportId}`, { method: "PATCH", json: { status } });
}

// ---- People -----------------------------------------------------------------------------------------------------

export function loadProfile(userId: string) {
  return request<Profile>(`/api/users/${userId}`);
}

export function followUser(userId: string) {
  return request<{ following: boolean }>(`/api/users/${userId}/follow`, { method: "POST" });
}

export function unfollowUser(userId: string) {
  return request<{ following: boolean }>(`/api/users/${userId}/follow`, { method: "DELETE" });
}

export function loadFeed(page = 1, pageSize = 20) {
  return request<{ items: FeedItem[]; pagination: Pagination; followingCount: number }>("/api/feed", {}, { query: { page, pageSize } });
}

// ---- Account ----------------------------------------------------------------------------------------------------

export async function loadAccount() {
  return (await request<{ user: Account }>("/api/account")).user;
}

export async function updateAccount(payload: { name?: string; bio?: string; image?: string | null }) {
  return (await request<{ user: Account }>("/api/account", { method: "PATCH", json: payload })).user;
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<{ ok: boolean }>("/api/account/password", { json: { currentPassword, newPassword } });
}

export function requestAvatarUpload(payload: { fileType: string; fileSize: number }) {
  return request<{ uploadUrl: string; storageKey: string }>("/api/account/avatar/upload-url", { json: payload });
}

export function finalizeAvatar(storageKey: string) {
  return request<{ user?: Account; image?: string }>("/api/account/avatar/finalize", { json: { storageKey } });
}

export function sendVerificationEmail() {
  return request<{ ok: boolean }>("/api/auth/verify/send", { method: "POST" });
}

export async function listDeletedVehicles() {
  return (await request<{ items: DeletedVehicle[] }>("/api/account/deleted-vehicles")).items;
}

// ---- Moderation -------------------------------------------------------------------------------------------------

export function hideContent(payload: { targetType: "VEHICLE" | "PHOTO" | "EVENT"; targetId: string; hidden: boolean; reason: string }) {
  return request<{ hidden: boolean }>("/api/moderation/content", { json: payload });
}

export function banUser(userId: string, payload: { banned: boolean; reason?: string }) {
  return request<{ banned: boolean }>(`/api/moderation/users/${userId}`, { method: "PATCH", json: payload });
}

export function listModerationLog(params: { page?: number; pageSize?: number; action?: string }) {
  return request<{ items: ModerationLogItem[]; pagination: Pagination }>(
    "/api/moderation/log",
    {},
    { query: { action: params.action, page: params.page ?? 1, pageSize: params.pageSize ?? 25 } },
  );
}
