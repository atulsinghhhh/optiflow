import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateFolderSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    parentId: z.string().uuid().nullable().optional(),
});

export async function GET(_request: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const folder = await prisma.folder.findUnique({
            where: { id },
            include: {
                // Include immediate children subfolders
                children: {
                    orderBy: { created_at: "asc" },
                },
                // Include files stored in this folder
                files: {
                    orderBy: { created_at: "desc" },
                },
            },
        });

        if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
        if (folder.userId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json({ folder }, { status: 200 });
    } catch (error) {
        console.error("Error fetching folder:", error);
        return NextResponse.json({ error: "Error fetching folder" }, { status: 500 });
    }
}

export async function PUT( request: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        const parsed = updateFolderSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
                { status: 422 }
            );
        }

        const { name, parentId } = parsed.data;

        // Confirm ownership before updating
        const existing = await prisma.folder.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
        if (existing.userId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const folder = await prisma.folder.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(parentId !== undefined && { parent_id: parentId }),
            },
        });

        return NextResponse.json({ folder }, { status: 200 });
    } catch (error) {
        console.error("Error updating folder:", error);
        return NextResponse.json({ error: "Error updating folder" }, { status: 500 });
    }
}

export async function DELETE( _request: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        // Confirm ownership
        const existing = await prisma.folder.findUnique({
            where: { id },
            include: { _count: { select: { children: true, files: true } } },
        });

        if (!existing) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
        if (existing.userId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Prevent deleting folders that still contain items
        if (existing._count.children > 0 || existing._count.files > 0) {
            return NextResponse.json(
                { error: "Cannot delete a folder that still contains sub-folders or files" },
                { status: 409 }
            );
        }

        await prisma.folder.delete({ where: { id } });

        return NextResponse.json({ message: "Folder deleted successfully" }, { status: 200 });
    } catch (error) {
        console.error("Error deleting folder:", error);
        return NextResponse.json({ error: "Error deleting folder" }, { status: 500 });
    }
}
