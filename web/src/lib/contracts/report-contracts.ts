import { z } from "zod";

// Allowed moderation states after a report has been submitted.
export const reportStatusSchema = z.enum(["PENDING", "REVIEWING", "RESOLVED", "REJECTED"]);

// Payload for creating a new vehicle report by authenticated users.
export const createReportRequestSchema = z.object({
  vehicleId: z.string().min(1),
  reason: z.string().trim().min(5).max(2000),
});

// Query shape for moderator report queue listing.
export const listReportsQuerySchema = z.object({
  status: reportStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// Route params for report detail operations.
export const reportIdParamsSchema = z.object({
  id: z.string().min(1),
});

// Payload for moderator status updates.
export const updateReportStatusRequestSchema = z.object({
  status: z.enum(["REVIEWING", "RESOLVED", "REJECTED"]),
});

// Keep success shapes open to allow additive fields over time.
export const createReportSuccessSchema = z.object({
  report: z.object({ id: z.string().min(1) }).passthrough(),
});

export const listReportsSuccessSchema = z.object({
  items: z.array(z.object({ id: z.string().min(1) }).passthrough()),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  }),
});

export const updateReportSuccessSchema = z.object({
  report: z.object({ id: z.string().min(1) }).passthrough(),
});
