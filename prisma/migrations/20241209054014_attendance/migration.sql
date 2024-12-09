/*
  Warnings:

  - You are about to drop the column `student_name` on the `attendance_responses` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "attendance_responses" DROP COLUMN "student_name",
ADD COLUMN     "enrollment" TEXT;
