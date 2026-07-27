/*
  Warnings:

  - The primary key for the `storage` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "storage" DROP CONSTRAINT "storage_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "storage_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "storage_id_seq";
