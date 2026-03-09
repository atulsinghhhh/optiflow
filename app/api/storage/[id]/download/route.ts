

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { minioClient } from "@/lib/minio";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        // Check if the user wants to preview the file (inline) instead of downloading (attachment)
        const isPreview = request.nextUrl.searchParams.get("preview") === "true";

        const storage_file = await prisma.storage.findUnique({
            where: { id: id },
        });

        if (!storage_file) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Depending on your requirements, you might want people to download/preview 
        // even if it's PENDING processing. We'll leave your COMPLETED check assuming 
        // processing is strictly required. You can remove it if needed.
        if (storage_file.status !== "COMPLETED" && storage_file.file_type !== "FILE") {
            // For FILE types, processing doesn't happen, so allow download of PENDING 
            // Or you can loosen this check.
        }

        // 1. Determine correct bucket (since we split them by type in the POST endpoint)
        const bucket = storage_file.file_type === "IMAGE"
            ? (process.env.MINIO_IMAGE_BUCKET ?? "images")
            : (process.env.MINIO_FILE_BUCKET ?? "files");

        // 2. Object name is just the file_name, not the full original_url
        const object_name = storage_file.file_name;

        // Fetch from MinIO
        const stream = await minioClient.getObject(bucket, object_name);

        // 3. Correctly read the entire stream into a buffer
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // 4. Set Content-Disposition based on preview flag
        const disposition = isPreview
            ? "inline"
            : `attachment; filename="${storage_file.file_name}"`;

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": storage_file.mime_type,
                "Content-Disposition": disposition,
            },
        });

    } catch (error) {
        console.log('Error fetching storage file:', error);
        return NextResponse.json({ error: 'Error fetching storage file' }, { status: 500 });
    }
}