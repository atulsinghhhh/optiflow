import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(_request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        const totalFiles = await prisma.storage.count({
            where: {
                user_id: userId
            }
        });

        const storageAggregate = await prisma.storage.aggregate({
            _sum: {
                file_size: true
            },
            where: {
                user_id: userId
            }
        });

        const totalStorageUsed = storageAggregate._sum.file_size || 0;

        // uploads this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const uploadsThisMonth = await prisma.storage.count({
            where: {
                user_id: userId,
                created_at: {
                    gte: startOfMonth
                }
            }
        });

        // Group by fileType to get counts for each type (IMAGE vs FILE)
        const fileTypes = await prisma.storage.groupBy({
            by: ['file_type'],
            where: { user_id: userId },
            _count: {
                file_type: true
            }
        });

        const formattedTypes: Record<string, number> = {};

        fileTypes.forEach((item) => {
            formattedTypes[item.file_type] = item._count.file_type;
        });

        return NextResponse.json({
            totalFiles,
            totalStorageUsed,
            uploadsThisMonth,
            fileTypes: formattedTypes
        });

    } catch (error) {
        console.error("Analytics error:", error);
        return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
    }
}