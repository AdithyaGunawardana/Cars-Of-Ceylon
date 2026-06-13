import { z } from "zod";

export const userIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const userProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  image: z.string().url().nullable().optional(),
  profile: z.unknown().nullable().optional(),
}).passthrough();

export const userProfileVehicleSchema = z.object({
  id: z.string().min(1),
  uniqueIdentifier: z.string().min(1),
  licensePlate: z.string().nullable().optional(),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1886).max(2100),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
}).passthrough();

export const userProfileResponseSchema = z.object({
  user: userProfileSchema,
  stats: z.object({
    vehicleCount: z.number().int().min(0),
    followerCount: z.number().int().min(0),
    followingCount: z.number().int().min(0),
  }),
  relationship: z.object({
    isSelf: z.boolean(),
    isFollowing: z.boolean(),
  }),
  vehicles: z.array(userProfileVehicleSchema),
});

export const followMutationResponseSchema = z.object({
  following: z.boolean(),
});
