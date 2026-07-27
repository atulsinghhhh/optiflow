import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const notifications = await prisma.notification.findMany({
            where: { user_id: session.user.id },
            orderBy: { created_at: "desc" },
            take: 30,
        });

        const unreadCount = await prisma.notification.count({
            where: { user_id: session.user.id, read: false },
        });

        return NextResponse.json({ notifications, unreadCount }, { status: 200 });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return NextResponse.json({ error: "Error fetching notifications" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { notificationId, markAll } = body;

        if (markAll) {
            await prisma.notification.updateMany({
                where: { user_id: session.user.id, read: false },
                data: { read: true },
            });
            return NextResponse.json({ success: true }, { status: 200 });
        }

        if (notificationId) {
            const notif = await prisma.notification.update({
                where: { id: notificationId, user_id: session.user.id },
                data: { read: true },
            });
            return NextResponse.json({ success: true, notification: notif }, { status: 200 });
        }

        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    } catch (error) {
        console.error("Error updating notification:", error);
        return NextResponse.json({ error: "Error updating notification" }, { status: 500 });
    }
}
