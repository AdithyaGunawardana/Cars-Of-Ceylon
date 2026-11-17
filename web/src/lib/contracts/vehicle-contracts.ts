import { z } from "zod";
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, vehicleAttributesSchema } from "@/lib/vehicle-attributes";

// Only web links are allowed: z.string().url() alone accepts javascript:/data: URLs that become XSS when rendered as href.
export const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((value) => /^https?:\/\//i.test(value), { message: "URL must start with http:// or https://" });

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
  // Full-text search across make, model, description, identifier, plate and timeline text.
  q: z.string().trim().min(2).max(100).optional(),
  yearFrom: z.coerce.number().int().min(1886).max(2100).optional(),
  yearTo: z.coerce.number().int().min(1886).max(2100).optional(),
  // Defaults to "relevance" when `q` is set, otherwise "newest".
  sort: z.enum(["newest", "oldest", "year_desc", "year_asc", "name", "relevance"]).optional(),
  color: z.string().trim().min(1).max(40).optional(),
  fuelType: z.enum(FUEL_TYPES).optional(),
  transmission: z.enum(TRANSMISSIONS).optional(),
  bodyType: z.enum(BODY_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).refine((value) => value.yearFrom === undefined || value.yearTo === undefined || value.yearFrom <= value.yearTo, {
  message: "yearFrom must not be after yearTo",
  path: ["yearFrom"],
});

// Contract for creating a new vehicle entry.
export const createVehicleRequestSchema = z.object({
  uniqueIdentifier: z.string().trim().min(2).max(40),
  licensePlate: z.string().trim().min(2).max(20).optional().nullable(),
  manufacturer: z.string().trim().min(2).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.number().int().min(1886).max(2100),
  description: z.string().trim().max(5000).optional().nullable(),
  attributes: vehicleAttributesSchema.optional().nullable(),
});

// Contract for patching existing vehicle metadata.
export const updateVehicleRequestSchema = z
  .object({
    uniqueIdentifier: z.string().trim().min(2).max(40).optional(),
    licensePlate: z.string().trim().min(2).max(20).nullable().optional(),
    manufacturer: z.string().trim().min(2).max(80).optional(),
    model: z.string().trim().min(1).max(80).optional(),
    year: z.number().int().min(1886).max(2100).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
    attributes: vehicleAttributesSchema.nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

// Contract for creating timeline events on vehicles.
export const createVehicleEventRequestSchema = z.object({
  type: z.enum(["CREATED", "OWNERSHIP_CHANGE", "SERVICE", "ACCIDENT", "MODIFICATION", "INSPECTION", "NOTE"]),
  title: z.string().trim().min(2).max(140),
  details: z.string().trim().max(5000).optional().nullable(),
  occurredAt: z.string().datetime().optional().nullable(),
  sourceUrl: httpUrlSchema.optional().nullable(),
});

// Contract for patching existing timeline events.
export const updateVehicleEventRequestSchema = z
  .object({
    type: z.enum(["CREATED", "OWNERSHIP_CHANGE", "SERVICE", "ACCIDENT", "MODIFICATION", "INSPECTION", "NOTE"]).optional(),
    title: z.string().trim().min(2).max(140).optional(),
    details: z.string().trim().max(5000).nullable().optional(),
    occurredAt: z.string().datetime().nullable().optional(),
    sourceUrl: httpUrlSchema.nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
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

export const vehicleDetailSuccessSchema = z.object({
  vehicle: z.object({ id: z.string().min(1) }).passthrough(),
});

export const updateVehicleSuccessSchema = z.object({
  vehicle: z.object({ id: z.string().min(1) }).passthrough(),
});

export const createVehicleEventSuccessSchema = z.object({
  event: z.object({ id: z.string().min(1) }).passthrough(),
});

export const updateVehicleEventSuccessSchema = z.object({
  event: z.object({ id: z.string().min(1) }).passthrough(),
});
