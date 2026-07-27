-- AlterTable
ALTER TABLE "storage" ADD COLUMN     "user_id" TEXT;

-- AddForeignKey
ALTER TABLE "storage" ADD CONSTRAINT "storage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
