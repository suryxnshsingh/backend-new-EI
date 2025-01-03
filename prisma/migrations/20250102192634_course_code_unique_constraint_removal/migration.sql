-- DropIndex
DROP INDEX "courses_course_code_key";

-- AlterTable
ALTER TABLE "reset_tokens" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '10 minutes';
