import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/*
    Resolves a share token and returns public file metadata.
        No authentication required — this is a public endpoint.
        Returns file metadata and a download URL the client can use.
        Does NOT stream the file directly; the download passes through
        Validates that the token exists and has not expired.
      /api/storage/[id]/download so all access is logged/controlled.
*/

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        // Look up the share record, include the linked storage file
        const sharedFile = await prisma.shared_file.findUnique({
            where: { token },
            include: {
                storage: {
                    select: {
                        id: true,
                        file_name: true,
                        file_size: true,
                        mime_type: true,
                        file_type: true,
                        status: true,
                    },
                },
                owner: {
                    select: { name: true, username: true },
                },
            },
        });

        if (!sharedFile) {
            return NextResponse.json({ error: "Share link not found or invalid" }, { status: 404 });
        }

        // Check if the link has expired
        if (sharedFile.expires_at && new Date() > sharedFile.expires_at) {
            return NextResponse.json(
                { error: "This share link has expired" },
                { status: 410 } // 410 Gone — the resource existed but is no longer available
            );
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

        return NextResponse.json(
            {
                token,
                file: {
                    id: sharedFile.storage.id,
                    name: sharedFile.storage.file_name,
                    size: sharedFile.storage.file_size,
                    mimeType: sharedFile.storage.mime_type,
                    fileType: sharedFile.storage.file_type,
                    status: sharedFile.storage.status,
                },
                sharedBy: sharedFile.owner.name ?? sharedFile.owner.username ?? "Anonymous",
                expiresAt: sharedFile.expires_at,
                createdAt: sharedFile.created_at,
                // The client can use these URLs to download or preview
                downloadUrl: `${baseUrl}/api/storage/${sharedFile.storage.id}/download`,
                previewUrl: `${baseUrl}/api/storage/${sharedFile.storage.id}/download?preview=true`,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error resolving share link:", error);
        return NextResponse.json({ error: "Error resolving share link" }, { status: 500 });
    }
}
