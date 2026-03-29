/*
  Warnings:

  - You are about to drop the column `vin` on the `Vehicle` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Vehicle_vin_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profile" JSONB;

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "vin",
ADD COLUMN     "attributes" JSONB;
