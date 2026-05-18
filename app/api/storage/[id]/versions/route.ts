import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;

        const rootFile = await prisma.storage.findUnique({
            where: { id, user_id: session.user.id },
        });

        if (!rootFile) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Fetch all historical version archives where parent_id matches rootFile.id
        const archives = await prisma.storage.findMany({
            where: { parent_id: rootFile.id, user_id: session.user.id },
            orderBy: { version: "desc" },
        });

        // The current rootFile is the latest version
        const versions = [
            rootFile,
            ...archives,
        ];

        return NextResponse.json({ versions }, { status: 200 });
    } catch (error) {
        console.error("Error fetching file versions:", error);
        return NextResponse.json({ error: "Error fetching file versions" }, { status: 500 });
    }
}
