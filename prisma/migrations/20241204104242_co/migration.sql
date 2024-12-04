-- AlterTable
ALTER TABLE "quiz_questions" ADD COLUMN     "image_caption" TEXT,
ADD COLUMN     "reference_image" TEXT;

-- CreateTable
CREATE TABLE "co" (
    "id" SERIAL NOT NULL,
    "MST1_Q1" TEXT NOT NULL,
    "MST1_Q2" TEXT NOT NULL,
    "MST1_Q3" TEXT NOT NULL,
    "MST2_Q1" TEXT NOT NULL,
    "MST2_Q2" TEXT NOT NULL,
    "MST2_Q3" TEXT NOT NULL,
    "QuizAssignment_Q1" TEXT NOT NULL,
    "QuizAssignment_Q2" TEXT NOT NULL,
    "QuizAssignment_Q3" TEXT NOT NULL,
    "QuizAssignment_Q4" TEXT NOT NULL,
    "QuizAssignment_Q5" TEXT NOT NULL,
    "course_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,

    CONSTRAINT "co_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "co" ADD CONSTRAINT "co_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co" ADD CONSTRAINT "co_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
