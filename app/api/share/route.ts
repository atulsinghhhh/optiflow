import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { nanoid } from "nanoid";
import { z } from "zod";


const createShareSchema = z.object({
    storageId: z.string().uuid("storageId must be a valid UUID"),
    expiresAt: z
        .string()
        .datetime({ message: "expiresAt must be an ISO 8601 datetime string" })
        .optional()
        .nullable(),
});

export async function POST(request: NextRequest) {
    try {
        // Must be authenticated to share a file
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized — please sign in" }, { status: 401 });
        }

        const body = await request.json();

        const parsed = createShareSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
                { status: 422 }
            );
        }

        const { storageId, expiresAt } = parsed.data;

        // Verify the storage record exists
        const storageFile = await prisma.storage.findUnique({ where: { id: storageId } });
        if (!storageFile) {
            return NextResponse.json({ error: "Storage file not found" }, { status: 404 });
        }

        // Generate a URL-safe 21-character token (nanoid default)
        const token = nanoid();

        const sharedFile = await prisma.shared_file.create({
            data: {
                token,
                storage_id: storageId,
                shared_by: session.user.id,
                expires_at: expiresAt ? new Date(expiresAt) : null,
            },
        });

        // Build the public share URL
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const shareUrl = `${baseUrl}/share/${token}`;

        return NextResponse.json(
            {
                token: sharedFile.token,
                shareUrl,
                expiresAt: sharedFile.expires_at,
                createdAt: sharedFile.created_at,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error creating share link:", error);
        return NextResponse.json({ error: "Error creating share link" }, { status: 500 });
    }
}
