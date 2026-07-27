-- CreateEnum
CREATE TYPE "fileType" AS ENUM ('IMAGE', 'FILE');

-- AlterTable
ALTER TABLE "storage" ADD COLUMN     "file_type" "fileType" NOT NULL DEFAULT 'FILE';

-- CreateTable
CREATE TABLE "file" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "total_chunk" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunk" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_size" INTEGER NOT NULL,
    "checkSum" TEXT NOT NULL,
    "storage_id" TEXT NOT NULL,

    CONSTRAINT "chunk_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_storage_id_fkey" FOREIGN KEY ("storage_id") REFERENCES "storage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
