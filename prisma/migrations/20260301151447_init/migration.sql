-- CreateEnum
CREATE TYPE "storageStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "storage" (
    "id" SERIAL NOT NULL,
    "status" "storageStatus" NOT NULL DEFAULT 'PENDING',
    "original_url" TEXT NOT NULL,
    "processed_url" TEXT,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_pkey" PRIMARY KEY ("id")
);
