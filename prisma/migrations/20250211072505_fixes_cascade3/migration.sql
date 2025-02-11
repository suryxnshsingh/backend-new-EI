-- DropForeignKey
ALTER TABLE "QuizAttempt" DROP CONSTRAINT "QuizAttempt_quizId_fkey";

-- AlterTable
ALTER TABLE "reset_tokens" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '10 minutes';

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
