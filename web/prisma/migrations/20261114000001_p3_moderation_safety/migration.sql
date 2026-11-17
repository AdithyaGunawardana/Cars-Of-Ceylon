-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('REPORT_REVIEWING', 'REPORT_RESOLVED', 'REPORT_REJECTED', 'VEHICLE_DELETE', 'VEHICLE_RESTORE', 'CONTENT_HIDE', 'CONTENT_UNHIDE', 'USER_BAN', 'USER_UNBAN');

-- CreateEnum
CREATE TYPE "ModerationTarget" AS ENUM ('REPORT', 'VEHICLE', 'PHOTO', 'EVENT', 'USER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "bannedAt" TIMESTAMP(3),
ADD COLUMN "banReason" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT,
ADD COLUMN "hiddenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VehicleEvent" ADD COLUMN "hiddenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VehiclePhoto" ADD COLUMN "hiddenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "ModerationAction" NOT NULL,
    "targetType" "ModerationTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationLog_createdAt_idx" ON "ModerationLog"("createdAt");

-- CreateIndex
CREATE INDEX "ModerationLog_targetType_targetId_idx" ON "ModerationLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Vehicle_deletedAt_idx" ON "Vehicle"("deletedAt");

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
