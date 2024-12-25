-- CreateTable
CREATE TABLE "reset_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reset_tokens_token_key" ON "reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "reset_tokens_user_id_key" ON "reset_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "reset_tokens" ADD CONSTRAINT "reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
