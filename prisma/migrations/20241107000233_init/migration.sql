/*
  Warnings:

  - You are about to drop the column `enrollmentNum` on the `students` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[enrollment_number]` on the table `students` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `enrollment_number` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "students" DROP COLUMN "enrollmentNum",
ADD COLUMN     "enrollment_number" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "students_enrollment_number_key" ON "students"("enrollment_number");
