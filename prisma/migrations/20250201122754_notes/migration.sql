-- AlterTable
ALTER TABLE "reset_tokens" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '10 minutes';

-- CreateTable
CREATE TABLE "notes" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
