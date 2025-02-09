/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Option` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Option" DROP COLUMN "imageUrl";

-- AlterTable
ALTER TABLE "reset_tokens" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '10 minutes';
