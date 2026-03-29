import { z } from "zod";

// Shared vehicle id route parameter contract.
export const vehicleIdParamsSchema = z.object({
  id: z.string().min(1),
});

// Contract for public vehicle list filters and pagination.
export const vehicleListQuerySchema = z.object({
  manufacturer: z.string().trim().min(1).max(80).optional(),
  model: z.string().trim().min(1).max(80).optional(),
  year: z.coerce.number().int().min(1886).max(2100).optional(),
  search: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// Contract for creating a new vehicle entry.
export const createVehicleRequestSchema = z.object({
  uniqueIdentifier: z.string().trim().min(2).max(40),
  licensePlate: z.string().trim().min(2).max(20).optional().nullable(),
  manufacturer: z.string().trim().min(2).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.number().int().min(1886).max(2100),
  description: z.string().trim().max(5000).optional().nullable(),
});

// Contract for creating timeline events on vehicles.
export const createVehicleEventRequestSchema = z.object({
  type: z.enum(["CREATED", "OWNERSHIP_CHANGE", "SERVICE", "ACCIDENT", "MODIFICATION", "INSPECTION", "NOTE"]),
  title: z.string().trim().min(2).max(140),
  details: z.string().trim().max(5000).optional().nullable(),
  occurredAt: z.string().datetime().optional().nullable(),
  sourceUrl: z.string().url().max(500).optional().nullable(),
});

// Keep success payloads open for backward-compatible field additions.
export const vehicleListSuccessSchema = z.object({
  items: z.array(z.object({ id: z.string().min(1) }).passthrough()),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  }),
});

export const createVehicleSuccessSchema = z.object({
  vehicle: z.object({ id: z.string().min(1) }).passthrough(),
});

export const createVehicleEventSuccessSchema = z.object({
  event: z.object({ id: z.string().min(1) }).passthrough(),
});
