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

// Account self-service (profile editing + password change).
const httpUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((value) => /^https?:\/\//i.test(value), "Must be an http(s) URL");

export const updateAccountSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    bio: z.string().trim().max(500).optional(),
    // Empty string / null clears the avatar.
    image: z.union([httpUrl, z.literal(""), z.null()]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must differ from the current password",
    path: ["newPassword"],
  });

export const accountResponseSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    name: z.string().nullable(),
    email: z.string().email(),
    image: z.string().nullable(),
    bio: z.string().nullable(),
  }),
});

// Avatar upload (presigned PUT, then finalize).
export const avatarUploadUrlSchema = z.object({
  fileType: z.string().min(1).max(100),
  fileSize: z.number().int().min(1),
});

export const avatarFinalizeSchema = z.object({
  storageKey: z.string().min(1).max(300),
});

// Password reset and email verification.
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(128),
});

export const confirmEmailSchema = z.object({
  token: z.string().min(20).max(200),
});
