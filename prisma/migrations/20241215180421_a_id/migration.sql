/*
  Warnings:

  - You are about to drop the column `attendance_id` on the `attendance` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "attendance_attendance_id_key";

-- AlterTable
ALTER TABLE "attendance" DROP COLUMN "attendance_id";
