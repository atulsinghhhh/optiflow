import { notifyClient } from "./http";

export type NotificationType = "system" | "storage" | "share";

// Mirrors backend/internal/models/Notification exactly — note lowercase enum
// values (the old mock UI used uppercase, which silently broke icon lookup).
export type Notification = {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    action_url?: string;
    read: boolean;
    created_at: string;
};

export async function listNotifications(): Promise<Notification[]> {
    const res = await notifyClient.get<Notification[]>("/notifications");
    return res.data;
}

export async function markNotificationRead(id: string): Promise<void> {
    await notifyClient.patch(`/notifications/${id}/read`);
}
