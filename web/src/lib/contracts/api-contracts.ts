import { z } from "zod";

// Standardized error payload used by API routes for stable client handling.
export const apiErrorSchema = z.object({
  error: z.string().min(1),
  details: z.unknown().optional(),
});
