import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { minioClient } from "@/lib/minio";
import { redis } from "@/lib/redis";
import { uploadTypeSchema, validateFile } from "@/lib/validations/storage";

import { auth } from "@/lib/auth";

/*
  POST /api/storage
    - Requires authenticated session.
    - Accepts multipart/form-data with a "file" field and an optional "type" field ("image" | "file").
    - Validates the upload type using Zod and the file (MIME type + size) using validateFile().
    - Uploads the file to MinIO (bucket: "images" for images, "files" for generic files).
    - Creates a storage record in PostgreSQL with PENDING status.
    - Pushes the job to the Redis processing queue (images only — files skip processing).
    - Returns 202 Accepted with the job_id, status, and fileType.
*/

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const folderId = formData.get("folderId") as string | null;

        if (!file) {
            return NextResponse.json(
                { error: "No file uploaded" },
                { status: 400 }
            );
        }

        //  Zod: validate the "type" field (defaults to "file") 
        const typeResult = uploadTypeSchema.safeParse({
            type: formData.get("type") ?? "file",
        });

        if (!typeResult.success) {
            return NextResponse.json(
                { error: "Invalid upload type", details: typeResult.error.flatten() },
                { status: 400 }
            );
        }

        const { type } = typeResult.data; // "image" | "file"

        // Validate file MIME type & size 
        const fileValidation = validateFile(file, type);
        if (!fileValidation.success) {
            return NextResponse.json(
                { error: fileValidation.error },
                { status: 400 }
            );
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generate unique file name
        const fileName = `${uuidv4()}-${file.name}`;

        // Choose bucket based on upload type: "images" for images, "files" for generic files
        let bucket = type === "image"
            ? (process.env.MINIO_IMAGE_BUCKET ?? "images")
            : (process.env.MINIO_FILE_BUCKET ?? "files");

        // MinIO / S3 bucket names cannot contain underscores or uppercase letters
        bucket = bucket.replace(/_/g, "-").toLowerCase();

        // Ensure the bucket exists
        const exists = await minioClient.bucketExists(bucket);
        if (!exists) {
            await minioClient.makeBucket(bucket, "us-east-1");
        }

        // Upload to MinIO
        await minioClient.putObject(bucket, fileName, buffer, buffer.length, {
            "Content-Type": file.type,
        });

        console.log(`File uploaded successfully: ${fileName} → bucket: ${bucket}`);

        // Build the public URL for the stored object
        const originalUrl = `${process.env.MINIO_PUBLIC_URL}/${bucket}/${fileName}`;
        const folder_id_val = folderId === "null" || !folderId ? null : folderId;

        // Check if a root file with the same clean name already exists in this folder
        const cleanName = file.name;
        const existingRoot = await prisma.storage.findFirst({
            where: {
                user_id: session.user.id,
                folder_id: folder_id_val,
                parent_id: null,
                file_name: { endsWith: `-${cleanName}` }
            }
        });

        let storageFile;

        if (existingRoot) {
            // Archive the existing root state into a child version record
            await prisma.storage.create({
                data: {
                    file_type: existingRoot.file_type,
                    status: existingRoot.status,
                    original_url: existingRoot.original_url,
                    processed_url: existingRoot.processed_url,
                    file_name: existingRoot.file_name,
                    user_id: existingRoot.user_id,
                    folder_id: existingRoot.folder_id,
                    file_size: existingRoot.file_size,
                    mime_type: existingRoot.mime_type,
                    version: existingRoot.version,
                    parent_id: existingRoot.id,
                    created_at: existingRoot.updated_at,
                }
            });

            const newVersion = existingRoot.version + 1;

            // Update the root record to reflect the new version
            storageFile = await prisma.storage.update({
                where: { id: existingRoot.id },
                data: {
                    original_url: originalUrl,
                    file_name: fileName,
                    file_size: file.size,
                    mime_type: file.type,
                    version: newVersion,
                    updated_at: new Date(),
                }
            });

            await prisma.notification.create({
                data: {
                    user_id: session.user.id,
                    type: "STORAGE",
                    title: "File Version Updated",
                    message: `Successfully uploaded version ${newVersion} of "${cleanName}".`,
                    action_url: `/dashboard/files`,
                }
            });
        } else {
            // Create a brand new storage record
            storageFile = await prisma.storage.create({
                data: {
                    file_type: type === "image" ? "IMAGE" : "FILE",
                    status: "PENDING",
                    original_url: originalUrl,
                    file_name: fileName,
                    file_size: file.size,
                    mime_type: file.type,
                    user_id: session.user.id,
                    folder_id: folder_id_val,
                    version: 1,
                },
            });

            await prisma.notification.create({
                data: {
                    user_id: session.user.id,
                    type: "STORAGE",
                    title: "New File Uploaded",
                    message: `Successfully uploaded "${cleanName}".`,
                    action_url: `/dashboard/files`,
                }
            });
        }

        // Only push images to the processing queue (files don't need image processing)
        if (type === "image") {
            await redis.lpush("processing_queue", storageFile.id);
        }

        return NextResponse.json(
            {
                job_id: storageFile.id,
                status: "PENDING",
                fileType: type,
            },
            { status: 202 }
        );
    } catch (error) {
        console.log("Error uploading file:", error);
        return NextResponse.json(
            { error: "Error uploading file" },
            { status: 500 }
        );
    }
}

/*
  GET /api/storage
    - Returns all uploaded files (images + documents) for the authenticated user, ordered by created_at descending.
*/

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const folderId = searchParams.get("folderId");
        const folder_id = folderId === "null" || !folderId ? null : folderId;
        const search = searchParams.get("search");

        const whereClause: any = { user_id: session.user.id, parent_id: null };

        if (search) {
            whereClause.file_name = { contains: search, mode: "insensitive" };
        } else {
            whereClause.folder_id = folder_id;
        }

        const files = await prisma.storage.findMany({
            where: whereClause,
            orderBy: {
                created_at: "desc",
            },
        });

        return NextResponse.json({ files }, { status: 200 });
    } catch (error) {
        console.log("Error fetching files:", error);
        return NextResponse.json(
            { error: "Error fetching files" },
            { status: 500 }
        );
    }
}
