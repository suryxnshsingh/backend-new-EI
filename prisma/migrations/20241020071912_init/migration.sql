-- CreateTable
CREATE TABLE "Teacher" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherId" INTEGER NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Sheet" (
    "id" TEXT NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "MST1_Q1" INTEGER,
    "MST1_Q2" INTEGER,
    "MST1_Q3" INTEGER,
    "MST2_Q1" INTEGER,
    "MST2_Q2" INTEGER,
    "MST2_Q3" INTEGER,
    "Quiz_Assignment" INTEGER,
    "EndSem_Q1" INTEGER,
    "EndSem_Q2" INTEGER,
    "EndSem_Q3" INTEGER,
    "EndSem_Q4" INTEGER,
    "EndSem_Q5" INTEGER,

    CONSTRAINT "Sheet_pkey" PRIMARY KEY ("id","subjectCode")
);

-- CreateTable
CREATE TABLE "CO" (
    "subjectCode" TEXT NOT NULL,
    "MST1_Q1" TEXT NOT NULL,
    "MST1_Q2" TEXT NOT NULL,
    "MST1_Q3" TEXT NOT NULL,
    "MST2_Q1" TEXT NOT NULL,
    "MST2_Q2" TEXT NOT NULL,
    "MST2_Q3" TEXT NOT NULL,
    "Quiz_Assignment" TEXT[],

    CONSTRAINT "CO_pkey" PRIMARY KEY ("subjectCode")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sheet" ADD CONSTRAINT "Sheet_subjectCode_fkey" FOREIGN KEY ("subjectCode") REFERENCES "Subject"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sheet" ADD CONSTRAINT "Sheet_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CO" ADD CONSTRAINT "CO_subjectCode_fkey" FOREIGN KEY ("subjectCode") REFERENCES "Subject"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
