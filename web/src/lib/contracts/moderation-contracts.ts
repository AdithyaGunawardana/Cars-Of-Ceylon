import { z } from "zod";

const reason = z.string().trim().min(3).max(1000);

export const hideContentRequestSchema = z.object({
  targetType: z.enum(["VEHICLE", "PHOTO", "EVENT"]),
  targetId: z.string().min(1),
  hidden: z.boolean(),
  reason,
});

export const banUserRequestSchema = z.object({
  banned: z.boolean(),
  // A ban must be explained; lifting one may omit it.
  reason: reason.optional(),
}).refine((value) => !value.banned || Boolean(value.reason), {
  message: "A reason is required to ban a user",
  path: ["reason"],
});

export const moderationLogQuerySchema = z.object({
  action: z
    .enum([
      "REPORT_REVIEWING",
      "REPORT_RESOLVED",
      "REPORT_REJECTED",
      "VEHICLE_DELETE",
      "VEHICLE_RESTORE",
      "CONTENT_HIDE",
      "CONTENT_UNHIDE",
      "USER_BAN",
      "USER_UNBAN",
    ])
    .optional(),
  targetType: z.enum(["REPORT", "VEHICLE", "PHOTO", "EVENT", "USER"]).optional(),
  targetId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
