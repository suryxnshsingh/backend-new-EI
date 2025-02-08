/*
  Warnings:

  - The `correctAnswer` column on the `Question` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "keywordMatchPercentage" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "keywords" TEXT[],
ADD COLUMN     "threshold" DOUBLE PRECISION,
DROP COLUMN "correctAnswer",
ADD COLUMN     "correctAnswer" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "reset_tokens" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '10 minutes';
