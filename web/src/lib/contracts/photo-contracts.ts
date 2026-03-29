import { z } from "zod";
import { apiErrorSchema } from "@/lib/contracts/api-contracts";

// Shared vehicle id schema for photo route params.
export const photoVehicleParamsSchema = z.object({
  id: z.string().min(1),
});

// Contract for requesting a signed upload URL.
export const photoUploadUrlRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  fileType: z.string().trim().min(1).max(100),
  fileSize: z.number().int().min(1),
});

// Success payload returned when signed upload URL generation succeeds.
export const photoUploadUrlSuccessSchema = z.object({
  uploadUrl: z.string().url(),
  storageKey: z.string().trim().min(1),
  publicUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
  maxBytes: z.number().int().positive(),
});

// Contract for finalizing an uploaded object into photo metadata.
export const photoFinalizeRequestSchema = z.object({
  storageKey: z.string().trim().min(1).max(512),
  caption: z.string().trim().max(500).optional().nullable(),
});

// Success payload for finalize endpoint keeps photo object open for future fields.
export const photoFinalizeSuccessSchema = z.object({
  photo: z.object({ id: z.string().min(1) }).passthrough(),
});

// Alias the shared API error schema for route-specific semantic clarity.
export const photoApiErrorSchema = apiErrorSchema;
