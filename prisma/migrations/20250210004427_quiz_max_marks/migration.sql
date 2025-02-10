-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "maxMarks" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "reset_tokens" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '10 minutes';
