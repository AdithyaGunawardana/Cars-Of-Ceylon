import { z } from "zod";

// Strict wire-format schemas (JSON as seen by web/mobile clients). Unlike the *Success schemas used by the
// mocked unit tests, these reject unknown fields, so accidental leaks (e.g. an email) or drift fail loudly.
// They are validated against real responses in tests/integration and are safe to reuse from mobile.

const isoDate = z.string().datetime();
const idString = z.string().min(1);

export const paginationWireSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict();

const vehicleFields = {
  id: idString,
  uniqueIdentifier: z.string(),
  licensePlate: z.string().nullable(),
  manufacturer: z.string(),
  model: z.string(),
  year: z.number().int(),
  description: z.string().nullable(),
  attributes: z.unknown(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  deletedAt: isoDate.nullable(),
  deletedById: z.string().nullable(),
  hiddenAt: isoDate.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
  createdByUserId: idString,
};

const publicUserRefSchema = z.object({ id: idString, name: z.string().nullable() }).strict();
const countsSchema = z.object({ photos: z.number().int(), events: z.number().int() }).strict();

export const eventWireSchema = z
  .object({
    id: idString,
    vehicleId: idString,
    userId: idString,
    type: z.enum(["CREATED", "OWNERSHIP_CHANGE", "SERVICE", "ACCIDENT", "MODIFICATION", "INSPECTION", "NOTE"]),
    title: z.string(),
    details: z.string().nullable(),
    occurredAt: isoDate.nullable(),
    sourceUrl: z.string().nullable(),
    hiddenAt: isoDate.nullable(),
    createdAt: isoDate,
    updatedAt: isoDate,
  })
  .strict();

export const photoWireSchema = z
  .object({
    id: idString,
    vehicleId: idString,
    userId: idString,
    storageKey: z.string(),
    url: z.string().url(),
    caption: z.string().nullable(),
    hiddenAt: isoDate.nullable(),
    createdAt: isoDate,
  })
  .strict();

// Row shape for list/create/update responses.
export const vehicleSummaryWireSchema = z
  .object({ ...vehicleFields, createdBy: publicUserRefSchema, _count: countsSchema })
  .strict();

export const vehicleDetailWireSchema = z
  .object({
    ...vehicleFields,
    createdBy: publicUserRefSchema,
    events: z.array(eventWireSchema),
    photos: z.array(photoWireSchema),
  })
  .strict();

export const vehicleListWireSchema = z
  .object({ items: z.array(vehicleSummaryWireSchema), pagination: paginationWireSchema })
  .strict();

export const vehicleDetailResponseWireSchema = z.object({ vehicle: vehicleDetailWireSchema }).strict();
export const vehicleSummaryResponseWireSchema = z.object({ vehicle: vehicleSummaryWireSchema }).strict();

const reportVehicleRefSchema = z
  .object({
    id: idString,
    uniqueIdentifier: z.string(),
    manufacturer: z.string(),
    model: z.string(),
    year: z.number().int(),
  })
  .strict();

export const reportWireSchema = z
  .object({
    id: idString,
    vehicleId: idString,
    createdById: idString,
    moderatedById: idString.nullable(),
    moderatedAt: isoDate.nullable(),
    reason: z.string(),
    status: z.enum(["PENDING", "REVIEWING", "RESOLVED", "REJECTED"]),
    createdAt: isoDate,
    updatedAt: isoDate,
    vehicle: reportVehicleRefSchema,
    createdBy: publicUserRefSchema,
    moderatedBy: publicUserRefSchema.nullable().optional(),
  })
  .strict();

export const reportListWireSchema = z
  .object({ items: z.array(reportWireSchema), pagination: paginationWireSchema })
  .strict();

export const reportResponseWireSchema = z.object({ report: reportWireSchema }).strict();

export const profileWireSchema = z
  .object({
    user: z
      .object({
        id: idString,
        name: z.string().nullable(),
        email: z.string().nullable(),
        image: z.string().nullable(),
        profile: z.unknown(),
        // Present only when the viewer is a moderator/admin.
        bannedAt: isoDate.nullable().optional(),
        role: z.enum(["USER", "MODERATOR", "ADMIN"]).optional(),
      })
      .strict(),
    stats: z
      .object({
        vehicleCount: z.number().int(),
        followerCount: z.number().int(),
        followingCount: z.number().int(),
      })
      .strict(),
    relationship: z.object({ isSelf: z.boolean(), isFollowing: z.boolean() }).strict(),
    vehicles: z.array(z.object({ ...vehicleFields, _count: countsSchema }).strict()),
  })
  .strict();
