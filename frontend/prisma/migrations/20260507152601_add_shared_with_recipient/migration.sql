-- AlterTable
ALTER TABLE "shared_file" ADD COLUMN     "shared_with_id" TEXT;

-- AddForeignKey
ALTER TABLE "shared_file" ADD CONSTRAINT "shared_file_shared_with_id_fkey" FOREIGN KEY ("shared_with_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
