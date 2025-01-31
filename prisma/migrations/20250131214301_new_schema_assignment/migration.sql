/*
  Warnings:

  - You are about to drop the column `feedback` on the `assignment_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `marks_obtained` on the `assignment_submissions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "assignment_submissions" DROP COLUMN "feedback",
DROP COLUMN "marks_obtained";

-- AlterTable
ALTER TABLE "reset_tokens" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '10 minutes';
