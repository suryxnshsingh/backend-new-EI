/*
  Warnings:

  - You are about to drop the column `file` on the `assignment_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `file` on the `assignments` table. All the data in the column will be lost.
  - You are about to drop the column `is_assignment` on the `assignments` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[assignment_id,student_id]` on the table `assignment_submissions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `due_date` to the `assignments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "assignment_submissions" DROP COLUMN "file",
ADD COLUMN     "file_url" TEXT,
ADD COLUMN     "is_late" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "assignments" DROP COLUMN "file",
DROP COLUMN "is_assignment",
ADD COLUMN     "accepting_submissions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "file_url" TEXT,
DROP COLUMN "due_date",
ADD COLUMN     "due_date" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "reset_tokens" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '10 minutes';

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submissions_assignment_id_student_id_key" ON "assignment_submissions"("assignment_id", "student_id");
