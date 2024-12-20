/*
  Warnings:

  - You are about to drop the column `date` on the `attendance_responses` table. All the data in the column will be lost.
  - You are about to drop the column `enrollment` on the `attendance_responses` table. All the data in the column will be lost.
  - You are about to drop the column `QuizAssignment_Q1` on the `co` table. All the data in the column will be lost.
  - You are about to drop the column `QuizAssignment_Q2` on the `co` table. All the data in the column will be lost.
  - You are about to drop the column `QuizAssignment_Q3` on the `co` table. All the data in the column will be lost.
  - You are about to drop the column `QuizAssignment_Q4` on the `co` table. All the data in the column will be lost.
  - You are about to drop the column `QuizAssignment_Q5` on the `co` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "attendance_responses" DROP COLUMN "date",
DROP COLUMN "enrollment";

-- AlterTable
ALTER TABLE "co" DROP COLUMN "QuizAssignment_Q1",
DROP COLUMN "QuizAssignment_Q2",
DROP COLUMN "QuizAssignment_Q3",
DROP COLUMN "QuizAssignment_Q4",
DROP COLUMN "QuizAssignment_Q5";
