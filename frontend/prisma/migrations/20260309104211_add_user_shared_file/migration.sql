-- AlterTable
ALTER TABLE "file" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "userId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_file" (
    "token" TEXT NOT NULL,
    "storage_id" TEXT NOT NULL,
    "shared_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_file_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "folder" ADD CONSTRAINT "folder_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder" ADD CONSTRAINT "folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_file" ADD CONSTRAINT "shared_file_storage_id_fkey" FOREIGN KEY ("storage_id") REFERENCES "storage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_file" ADD CONSTRAINT "shared_file_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
