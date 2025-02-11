-- DropForeignKey
ALTER TABLE "Option" DROP CONSTRAINT "Option_questionId_fkey";

-- AlterTable
ALTER TABLE "reset_tokens" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '10 minutes';

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
