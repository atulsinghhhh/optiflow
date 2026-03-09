import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";


/*
  GET /api/storage/[id]
    - Fetches a single storage record by its UUID.
    - Returns file metadata including status, URLs, and fileType ("IMAGE" | "FILE").
    - If status is PENDING/PROCESSING, the frontend shows a spinner.
    - If COMPLETED, the frontend shows the processed result (image preview or download link).
*/

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const storage_file = await prisma.storage.findUnique({
            where: { id: id },
        });

        if (!storage_file) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }
        return NextResponse.json({
            id: storage_file.id,
            status: storage_file.status,
            fileType: storage_file.file_type,
            originalUrl: storage_file.original_url,
            processedUrl: storage_file.processed_url
        }, { status: 200 });

    } catch (error) {
        console.log('Error fetching storage file:', error);
        return NextResponse.json({ error: 'Error fetching storage file' }, { status: 500 });
    }
}

