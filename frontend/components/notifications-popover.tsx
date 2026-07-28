"use client";

import { Bell, Sparkles, Share2, HardDrive, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { useMarkNotificationRead, useNotifications, useNotificationSocket } from "@/lib/hooks/use-notifications";
import type { Notification, NotificationType } from "@/lib/api/notifications";

function getIcon(type: NotificationType) {
    switch (type) {
        case "share":
            return <Share2 className="text-success" size={16} />;
        case "storage":
            return <HardDrive className="text-primary" size={16} />;
        case "system":
        default:
            return <Sparkles className="text-warning" size={16} />;
    }
}

export function NotificationsPopover() {
    const router = useRouter();
    const { data: notifications = [] } = useNotifications();
    const markRead = useMarkNotificationRead();
    useNotificationSocket();

    const unreadCount = notifications.filter((n) => !n.read).length;

    const handleNotificationClick = (n: Notification) => {
        if (!n.read) markRead.mutate(n.id);
        if (n.action_url) router.push(n.action_url);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-xl relative">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-destructive text-[10px] font-bold text-destructive-foreground rounded-full flex items-center justify-center shadow-md"
                        >
                            {unreadCount}
                        </motion.div>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 overflow-hidden rounded-2xl">
                <div className="p-4 bg-muted/60 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell size={16} className="text-primary" />
                        <span className="font-bold text-foreground text-sm">Notifications</span>
                        {unreadCount > 0 && (
                            <span className="text-[10px] bg-primary/15 text-primary font-semibold px-2 py-0.5 rounded-full">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                </div>

                <div className="max-h-[380px] overflow-y-auto divide-y divide-border">
                    <AnimatePresence>
                        {notifications.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground text-xs">
                                <Sparkles size={24} className="mx-auto mb-2 opacity-40" />
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <motion.div
                                    key={n.id}
                                    layout
                                    onClick={() => handleNotificationClick(n)}
                                    className={`p-4 cursor-pointer transition-colors flex items-start gap-3 ${
                                        !n.read ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/60"
                                    }`}
                                >
                                    <div className="p-2 bg-muted rounded-xl mt-0.5 shrink-0 border border-border">
                                        {getIcon(n.type)}
                                    </div>
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <h5 className={`text-xs font-bold truncate ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                                                {n.title}
                                            </h5>
                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                            {n.message}
                                        </p>
                                        {n.action_url && (
                                            <div className="flex items-center gap-1 text-[10px] text-primary font-semibold pt-1">
                                                View action <ArrowRight size={10} />
                                            </div>
                                        )}
                                    </div>
                                    {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
