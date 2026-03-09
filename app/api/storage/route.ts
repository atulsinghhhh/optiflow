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
        const bucket = type === "image"
            ? (process.env.MINIO_IMAGE_BUCKET ?? "images")
            : (process.env.MINIO_FILE_BUCKET ?? "files");

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

        // Persist the storage record with file_type
        const storageFile = await prisma.storage.create({
            data: {
                file_type: type === "image" ? "IMAGE" : "FILE",
                status: "PENDING",
                original_url: originalUrl,
                file_name: fileName,
                file_size: file.size,
                mime_type: file.type,
                user_id: session.user.id,
            },
        });

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

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const files = await prisma.storage.findMany({
            where: {
                user_id: session.user.id
            },
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
