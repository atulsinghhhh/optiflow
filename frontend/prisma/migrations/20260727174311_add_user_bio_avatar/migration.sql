-- CreateEnum
CREATE TYPE "notificationType" AS ENUM ('SHARE', 'SYSTEM', 'STORAGE');

-- AlterTable
ALTER TABLE "storage" ADD COLUMN     "parent_id" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "bio" TEXT;

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "notificationType" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "action_url" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage" ADD CONSTRAINT "storage_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "storage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
