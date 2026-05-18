import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                bio: true,
                avatar_url: true,
                created_at: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Calculate total storage used across all user's files
        const storageStats = await prisma.storage.aggregate({
            where: { user_id: session.user.id },
            _sum: { file_size: true },
            _count: { id: true },
        });

        const storageUsed = storageStats._sum.file_size || 0;
        const fileCount = storageStats._count.id || 0;
        const storageLimit = 1073741824; // 1 GB default limit

        return NextResponse.json({
            user,
            stats: {
                storageUsed,
                storageLimit,
                fileCount,
            },
        }, { status: 200 });
    } catch (error) {
        console.error("Error fetching profile:", error);
        return NextResponse.json({ error: "Error fetching profile" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { name, username, bio, avatar_url } = body;

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name: name !== undefined ? name : undefined,
                username: username !== undefined ? username : undefined,
                bio: bio !== undefined ? bio : undefined,
                avatar_url: avatar_url !== undefined ? avatar_url : undefined,
            },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                bio: true,
                avatar_url: true,
            },
        });

        return NextResponse.json({ user: updatedUser, success: true }, { status: 200 });
    } catch (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json({ error: "Error updating profile" }, { status: 500 });
    }
}
