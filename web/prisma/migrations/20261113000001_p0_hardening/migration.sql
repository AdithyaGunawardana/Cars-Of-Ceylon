-- Normalize existing emails so case variants cannot create duplicate accounts.
-- If two rows differ only by case this statement fails on the unique index; resolve those manually first.
UPDATE "User" SET "email" = lower("email") WHERE "email" <> lower("email");

-- Track when a moderator last acted on a report.
ALTER TABLE "Report" ADD COLUMN "moderatedAt" TIMESTAMP(3);
UPDATE "Report" SET "moderatedAt" = "updatedAt" WHERE "moderatedById" IS NOT NULL;

-- A storage object may back at most one photo record.
CREATE UNIQUE INDEX "VehiclePhoto_storageKey_key" ON "VehiclePhoto"("storageKey");
