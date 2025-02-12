/*
  Warnings:

  - You are about to drop the `_CourseToQuiz` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `courseId` to the `Quiz` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_CourseToQuiz" DROP CONSTRAINT "_CourseToQuiz_A_fkey";

-- DropForeignKey
ALTER TABLE "_CourseToQuiz" DROP CONSTRAINT "_CourseToQuiz_B_fkey";

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "courseId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "reset_tokens" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '10 minutes';

-- DropTable
DROP TABLE "_CourseToQuiz";

-- CreateIndex
CREATE INDEX "Quiz_courseId_idx" ON "Quiz"("courseId");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
