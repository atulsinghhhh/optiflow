import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const createFolderSchema = z.object({
    name: z.string().min(1, "Folder name cannot be empty").max(255),
    parentId: z.string().uuid("Invalid parent folder ID").optional().nullable(),
});

export async function POST(request: NextRequest) {
    try {
        // Validate session
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized — please sign in" }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await request.json();

        // Validate request body
        const parsed = createFolderSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
                { status: 422 }
            );
        }

        const { name, parentId } = parsed.data;

        // If a parentId is provided, confirm it belongs to the current user
        if (parentId) {
            const parentFolder = await prisma.folder.findUnique({ where: { id: parentId } });
            if (!parentFolder) {
                return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
            }
            if (parentFolder.userId !== userId) {
                return NextResponse.json({ error: "Forbidden — parent folder belongs to another user" }, { status: 403 });
            }
        }

        const folder = await prisma.folder.create({
            data: {
                name,
                parent_id: parentId ?? null,
                userId,
            },
        });

        return NextResponse.json({ folder }, { status: 201 });
    } catch (error) {
        console.error("Error creating folder:", error);
        return NextResponse.json({ error: "Error creating folder" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        // Validate session
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized — please sign in" }, { status: 401 });
        }

        const userId = session.user.id;

        // Support navigation by filtering by parentId and search
        const { searchParams } = new URL(request.url);
        const parentId = searchParams.get("parentId");
        const parent_id = parentId === "null" || !parentId ? null : parentId;
        const search = searchParams.get("search");

        // Return folders for the user based on the specified parent_id or search query
        const whereClause: any = { userId };

        if (search) {
            whereClause.name = { contains: search, mode: "insensitive" };
        } else {
            whereClause.parent_id = parent_id;
        }

        const folders = await prisma.folder.findMany({
            where: whereClause,
            orderBy: { created_at: "desc" },
            include: {
                _count: { select: { children: true, files: true } },
            },
        });

        return NextResponse.json({ folders }, { status: 200 });
    } catch (error) {
        console.error("Error listing folders:", error);
        return NextResponse.json({ error: "Error listing folders" }, { status: 500 });
    }
}