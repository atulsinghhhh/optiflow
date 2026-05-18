import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { minioClient } from "@/lib/minio";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;

        const storage_file = await prisma.storage.findUnique({
            where: { id },
        });

        if (!storage_file) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }
        return NextResponse.json({
            id: storage_file.id,
            status: storage_file.status,
            fileType: storage_file.file_type,
            originalUrl: storage_file.original_url,
            processedUrl: storage_file.processed_url,
            fileName: storage_file.file_name,
            fileSize: storage_file.file_size,
            version: storage_file.version,
        }, { status: 200 });

    } catch (error) {
        console.log('Error fetching storage file:', error);
        return NextResponse.json({ error: 'Error fetching storage file' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;

        const file = await prisma.storage.findUnique({
            where: { id, user_id: session.user.id },
        });

        if (!file) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Clean filename for notification
        const cleanName = file.file_name.split('-').slice(5).join('-') || file.file_name;

        // Delete all child archives and the root file
        await prisma.storage.deleteMany({
            where: { parent_id: file.id, user_id: session.user.id },
        });

        await prisma.storage.delete({
            where: { id: file.id },
        });

        await prisma.notification.create({
            data: {
                user_id: session.user.id,
                type: "STORAGE",
                title: "File Deleted",
                message: `Successfully deleted "${cleanName}".`,
                action_url: `/dashboard/files`,
            }
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.log('Error deleting storage file:', error);
        return NextResponse.json({ error: 'Error deleting storage file' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;
        const body = await request.json();
        const { file_name } = body;

        if (!file_name || !file_name.trim()) {
            return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
        }

        const file = await prisma.storage.findUnique({
            where: { id, user_id: session.user.id },
        });

        if (!file) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Preserve UUID prefix if present, or prepend one
        const parts = file.file_name.split('-');
        let uuidPrefix = "";
        if (parts.length >= 5 && parts[0].length === 8) {
            uuidPrefix = parts.slice(0, 5).join('-') + '-';
        } else {
            uuidPrefix = `${uuidv4()}-`;
        }

        const newFullName = `${uuidPrefix}${file_name.trim()}`;

        const updatedFile = await prisma.storage.update({
            where: { id },
            data: { file_name: newFullName, updated_at: new Date() },
        });

        await prisma.notification.create({
            data: {
                user_id: session.user.id,
                type: "STORAGE",
                title: "File Renamed",
                message: `Renamed file to "${file_name.trim()}".`,
                action_url: `/dashboard/files`,
            }
        });

        return NextResponse.json({ file: updatedFile }, { status: 200 });
    } catch (error) {
        console.log('Error renaming storage file:', error);
        return NextResponse.json({ error: 'Error renaming storage file' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;

        const existingRoot = await prisma.storage.findUnique({
            where: { id, user_id: session.user.id },
        });

        if (!existingRoot || existingRoot.parent_id !== null) {
            return NextResponse.json({ error: "Active root file not found" }, { status: 404 });
        }

        const formData = await request.formData();
        const uploadFile = formData.get("file") as File;

        if (!uploadFile) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const bytes = await uploadFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileName = `${uuidv4()}-${uploadFile.name}`;

        const isImage = uploadFile.type.startsWith("image/");
        let bucket = isImage
            ? (process.env.MINIO_IMAGE_BUCKET ?? "images")
            : (process.env.MINIO_FILE_BUCKET ?? "files");
        bucket = bucket.replace(/_/g, "-").toLowerCase();

        const exists = await minioClient.bucketExists(bucket);
        if (!exists) {
            await minioClient.makeBucket(bucket, "us-east-1");
        }

        await minioClient.putObject(bucket, fileName, buffer, buffer.length, {
            "Content-Type": uploadFile.type,
        });

        const originalUrl = `${process.env.MINIO_PUBLIC_URL}/${bucket}/${fileName}`;

        // Archive current state into a child record
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

        const newVersion = (existingRoot.version || 1) + 1;

        // Update root record in place
        const updatedRoot = await prisma.storage.update({
            where: { id: existingRoot.id },
            data: {
                original_url: originalUrl,
                file_name: fileName,
                file_size: uploadFile.size,
                mime_type: uploadFile.type,
                version: newVersion,
                updated_at: new Date(),
            }
        });

        const cleanName = uploadFile.name;
        await prisma.notification.create({
            data: {
                user_id: session.user.id,
                type: "STORAGE",
                title: "File Updated (New Version)",
                message: `Uploaded version ${newVersion} for "${cleanName}".`,
                action_url: `/dashboard/files`,
            }
        });

        return NextResponse.json({ file: updatedRoot, version: newVersion }, { status: 200 });
    } catch (error) {
        console.log('Error updating storage version:', error);
        return NextResponse.json({ error: 'Error updating storage version' }, { status: 500 });
    }
}
