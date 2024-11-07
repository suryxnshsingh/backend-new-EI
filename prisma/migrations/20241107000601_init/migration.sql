-- DropIndex
DROP INDEX "students_enrollment_number_key";

-- AlterTable
ALTER TABLE "students" ALTER COLUMN "enrollment_number" DROP NOT NULL;
