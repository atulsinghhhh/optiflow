"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { FileIcon, Download, Share2, Search, Grid, List as ListIcon, ImageIcon, FileText, Video, Music, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { NotificationsPopover } from "@/components/notifications-popover";

type SharedFile = {
    token: string;
    storage: {
        id: string;
        file_name: string;
        file_size: number;
        mime_type: string;
        file_type: "IMAGE" | "FILE";
        created_at: string;
    };
    owner: {
        name: string;
        email: string;
    };
    created_at: string;
};

export default function SharedWithMePage() {
    const { data: session } = useSession();
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [searchQuery, setSearchQuery] = useState("");
    const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSharedFiles = async () => {
        try {
            setLoading(true);
            const res = await axios.get("/api/share");
            setSharedFiles(res.data.sharedFiles);
        } catch (error) {
            toast.error("Failed to load shared files");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSharedFiles();
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    const getFileIcon = (mime: string) => {
        if (mime.startsWith("image/")) return <ImageIcon className="text-pink-400" size={20} />;
        if (mime.startsWith("video/")) return <Video className="text-orange-400" size={20} />;
        if (mime.startsWith("audio/")) return <Music className="text-cyan-400" size={20} />;
        if (mime.includes("pdf") || mime.includes("word")) return <FileText className="text-blue-400" size={20} />;
        return <FileIcon className="text-slate-400" size={20} />;
    };

    const filteredFiles = sharedFiles.filter(f => 
        f.storage.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.owner.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/50">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Shared with me</h1>
                    <p className="text-slate-400 text-sm mt-1">Files others have shared with you</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative group min-w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4.5 h-4.5" />
                        <Input
                            placeholder="Search shared files..."
                            className="pl-11 h-11 bg-slate-800/40 border-slate-700/50 rounded-xl text-slate-200"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <NotificationsPopover />
                </div>
            </header>

            <div className="flex items-center justify-between">
                <div className="flex bg-slate-800/40 p-1 rounded-xl border border-slate-700/50">
                    <Button 
                        variant={viewMode === "grid" ? "secondary" : "ghost"} 
                        size="sm" 
                        onClick={() => setViewMode("grid")}
                        className={cn("h-8 px-3 gap-2 rounded-lg", viewMode === "grid" ? "bg-slate-700 text-white" : "text-slate-400")}
                    >
                        <Grid size={16} /> Grid
                    </Button>
                    <Button 
                        variant={viewMode === "list" ? "secondary" : "ghost"} 
                        size="sm" 
                        onClick={() => setViewMode("list")}
                        className={cn("h-8 px-3 gap-2 rounded-lg", viewMode === "list" ? "bg-slate-700 text-white" : "text-slate-400")}
                    >
                        <ListIcon size={16} /> List
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="h-[40vh] flex items-center justify-center">
                    <div className="h-12 w-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    {filteredFiles.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="h-[50vh] flex flex-col items-center justify-center text-center p-12 bg-slate-800/20 border border-dashed border-slate-700/50 rounded-[32px]"
                        >
                            <Share2 size={64} className="text-slate-600 mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">No shared files yet</h3>
                            <p className="text-slate-400 max-w-sm mx-auto">When someone shares a file with you via your email, it will appear here.</p>
                        </motion.div>
                    ) : (
                        <div className={cn(
                            "grid gap-6",
                            viewMode === "grid" 
                                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                                : "grid-cols-1"
                        )}>
                            {filteredFiles.map(file => (
                                <motion.div 
                                    key={file.token}
                                    layout
                                    className="group p-5 bg-slate-800/20 hover:bg-slate-800/40 backdrop-blur-md border border-slate-700/30 rounded-2xl transition-all duration-300"
                                >
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="p-3 bg-slate-900/50 rounded-xl">
                                            {getFileIcon(file.storage.mime_type)}
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => window.open(`/api/storage/${file.storage.id}/download`, '_blank')}
                                            className="h-8 w-8 text-slate-500 hover:text-white"
                                        >
                                            <Download size={18} />
                                        </Button>
                                    </div>

                                    {file.storage.file_type === "IMAGE" && (
                                        <div className="mb-4 aspect-video rounded-xl overflow-hidden bg-slate-900/50 border border-slate-700/30">
                                            <img 
                                                src={`/api/storage/${file.storage.id}/download?preview=true`} 
                                                alt={file.storage.file_name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-white truncate text-sm" title={file.storage.file_name}>
                                            {file.storage.file_name.split('-').slice(5).join('-') || file.storage.file_name}
                                        </h4>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                            <span>{formatBytes(file.storage.file_size)}</span>
                                            <span>•</span>
                                            <span>{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-700/30 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-[10px] font-bold text-white">
                                                {file.owner.name[0]}
                                            </div>
                                            <span className="text-[10px] text-slate-400 truncate max-w-[100px] font-medium">
                                                {file.owner.name}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => window.open(`/api/storage/${file.storage.id}/download?preview=true`, '_blank')}
                                            className="text-[10px] font-bold uppercase tracking-wider text-violet-400 hover:text-violet-300 transition-colors"
                                        >
                                            View
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}
