import { describe, expect, it } from "vitest";
import { canManageVehicle, canTransitionReport, canViewVehicle } from "@/lib/authz";

const owner = { id: "o1", role: "USER" as const };
const stranger = { id: "u2", role: "USER" as const };
const moderator = { id: "m1", role: "MODERATOR" as const };
const admin = { id: "a1", role: "ADMIN" as const };
const publicVehicle = { visibility: "PUBLIC" as const, createdByUserId: "o1" };
const privateVehicle = { visibility: "PRIVATE" as const, createdByUserId: "o1" };

describe("canManageVehicle", () => {
  it("allows owner, moderator and admin only", () => {
    expect(canManageVehicle(owner, publicVehicle)).toBe(true);
    expect(canManageVehicle(moderator, publicVehicle)).toBe(true);
    expect(canManageVehicle(admin, publicVehicle)).toBe(true);
    expect(canManageVehicle(stranger, publicVehicle)).toBe(false);
    expect(canManageVehicle(null, publicVehicle)).toBe(false);
  });
});

describe("canViewVehicle", () => {
  it("shows public vehicles to everyone", () => {
    expect(canViewVehicle(null, publicVehicle)).toBe(true);
    expect(canViewVehicle(stranger, publicVehicle)).toBe(true);
  });

  it("shows private vehicles to owner, moderators and admins only", () => {
    expect(canViewVehicle(owner, privateVehicle)).toBe(true);
    expect(canViewVehicle(moderator, privateVehicle)).toBe(true);
    expect(canViewVehicle(admin, privateVehicle)).toBe(true);
    expect(canViewVehicle(stranger, privateVehicle)).toBe(false);
    expect(canViewVehicle(null, privateVehicle)).toBe(false);
  });
});

describe("canTransitionReport", () => {
  it("only allows PENDING -> REVIEWING -> RESOLVED|REJECTED", () => {
    expect(canTransitionReport("PENDING", "REVIEWING")).toBe(true);
    expect(canTransitionReport("REVIEWING", "RESOLVED")).toBe(true);
    expect(canTransitionReport("REVIEWING", "REJECTED")).toBe(true);
    expect(canTransitionReport("PENDING", "RESOLVED")).toBe(false);
    expect(canTransitionReport("PENDING", "REJECTED")).toBe(false);
    expect(canTransitionReport("RESOLVED", "REVIEWING")).toBe(false);
    expect(canTransitionReport("REJECTED", "PENDING")).toBe(false);
  });
});
