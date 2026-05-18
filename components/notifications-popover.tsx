"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Bell, CheckCheck, Sparkles, Share2, HardDrive, ShieldAlert, FileText, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type Notification = {
    id: string;
    type: "SHARE" | "SYSTEM" | "STORAGE";
    title: string;
    message: string;
    action_url: string | null;
    read: boolean;
    created_at: string;
};

export function NotificationsPopover() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const router = useRouter();

    const fetchNotifications = async () => {
        try {
            const res = await axios.get("/api/notifications");
            setNotifications(res.data.notifications || []);
            setUnreadCount(res.data.unreadCount || 0);
        } catch (error) {
            console.error("Failed to load notifications", error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Periodically poll for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleMarkAsRead = async (id?: string) => {
        try {
            if (!id) {
                await axios.patch("/api/notifications", { markAll: true });
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                setUnreadCount(0);
            } else {
                await axios.patch("/api/notifications", { notificationId: id });
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error("Error marking notification read", error);
        }
    };

    const handleNotificationClick = (n: Notification) => {
        if (!n.read) handleMarkAsRead(n.id);
        if (n.action_url) {
            router.push(n.action_url);
        }
    };

    const getIcon = (type: Notification["type"]) => {
        switch (type) {
            case "SHARE": return <Share2 className="text-emerald-400" size={16} />;
            case "STORAGE": return <HardDrive className="text-violet-400" size={16} />;
            case "SYSTEM":
            default: return <Sparkles className="text-amber-400" size={16} />;
        }
    };

    return (
        <DropdownMenu onOpenChange={(open) => open && fetchNotifications()}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white rounded-xl relative">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-linear-to-r from-violet-600 to-rose-600 text-[10px] font-bold text-white rounded-full flex items-center justify-center shadow-md animate-pulse"
                        >
                            {unreadCount}
                        </motion.div>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 sm:w-96 bg-slate-900 border-slate-800 text-slate-200 shadow-2xl p-0 overflow-hidden rounded-2xl">
                <div className="p-4 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell size={16} className="text-violet-400" />
                        <span className="font-bold text-white text-sm">Notifications</span>
                        {unreadCount > 0 && (
                            <span className="text-[10px] bg-violet-500/20 text-violet-300 font-semibold px-2 py-0.5 rounded-full">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); handleMarkAsRead(); }}
                            className="text-xs text-slate-400 hover:text-white h-auto p-1 gap-1"
                        >
                            <CheckCheck size={14} /> Mark all read
                        </Button>
                    )}
                </div>

                <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/50">
                    <AnimatePresence>
                        {notifications.length === 0 ? (
                            <div className="py-12 text-center text-slate-500 text-xs">
                                <Sparkles size={24} className="mx-auto mb-2 opacity-40" />
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map(n => (
                                <motion.div
                                    key={n.id}
                                    layout
                                    onClick={() => handleNotificationClick(n)}
                                    className={`p-4 cursor-pointer transition-colors flex items-start gap-3 ${
                                        !n.read ? "bg-violet-500/5 hover:bg-violet-500/10" : "hover:bg-slate-800/40"
                                    }`}
                                >
                                    <div className="p-2 bg-slate-800/80 rounded-xl mt-0.5 shrink-0 border border-slate-700/50 shadow-inner">
                                        {getIcon(n.type)}
                                    </div>
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <h5 className={`text-xs font-bold truncate ${!n.read ? "text-white" : "text-slate-300"}`}>
                                                {n.title}
                                            </h5>
                                            <span className="text-[10px] text-slate-500 shrink-0">
                                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                                            {n.message}
                                        </p>
                                        {n.action_url && (
                                            <div className="flex items-center gap-1 text-[10px] text-violet-400 font-semibold pt-1">
                                                View action <ArrowRight size={10} />
                                            </div>
                                        )}
                                    </div>
                                    {!n.read && (
                                        <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5 shadow-xs shadow-violet-500" />
                                    )}
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
