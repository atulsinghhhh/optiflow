import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { listNotifications, markNotificationRead, type Notification } from "@/lib/api/notifications";
import { subscribeAccessToken } from "@/lib/api/token";
import { NotificationSocket } from "@/lib/api/ws";

const notificationsKey = ["notifications"] as const;

export function useNotifications() {
    return useQuery({
        queryKey: notificationsKey,
        queryFn: listNotifications,
    });
}

export function useMarkNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: markNotificationRead,
        onMutate: async (id: string) => {
            await queryClient.cancelQueries({ queryKey: notificationsKey });
            const previous = queryClient.getQueryData<Notification[]>(notificationsKey);
            queryClient.setQueryData<Notification[]>(notificationsKey, (old) =>
                old?.map((n) => (n.id === id ? { ...n, read: true } : n)),
            );
            return { previous };
        },
        onError: (_err, _id, context) => {
            if (context?.previous) queryClient.setQueryData(notificationsKey, context.previous);
        },
    });
}

// Subscribes a live WebSocket connection to notify-svc and pushes incoming
// notifications straight into the React Query cache — no polling.
export function useNotificationSocket() {
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const socketRef = useRef<NotificationSocket | null>(null);

    useEffect(() => {
        const token = session?.accessToken;
        if (!token) return;

        const socket = new NotificationSocket();
        socketRef.current = socket;
        socket.connect(token, {
            onMessage: (notification) => {
                queryClient.setQueryData<Notification[]>(notificationsKey, (old) =>
                    old ? [notification, ...old] : [notification],
                );
            },
        });

        const unsubscribe = subscribeAccessToken((newToken) => {
            if (newToken) socket.reconnectWithToken(newToken);
        });

        return () => {
            unsubscribe();
            socket.close();
            socketRef.current = null;
        };
    }, [session?.accessToken, queryClient]);
}
