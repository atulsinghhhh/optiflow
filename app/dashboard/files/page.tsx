"use client";

import { useState, useEffect, useTransition, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { useSession } from "next-auth/react";
import { Folder as FolderIcon,FileIcon,UploadCloud,Plus,MoreVertical,Share2,Download,Trash2,FolderOpen,Search,Grid,List as ListIcon,ArrowLeft,Image as ImageIcon,FileText,Video,Music,MoreHorizontal,Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTrigger, DialogTitle, } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup,} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Folder = {
    id: string;
    name: string;
    created_at: string;
    _count: { children: number; files: number };
};

type FileItem = {
    id: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    file_type: "IMAGE" | "FILE";
    created_at: string;
};

export default function FileManagerPage() {
    return (
        <Suspense fallback={
            <div className="h-[60vh] flex items-center justify-center">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-8 w-8 rounded-full bg-violet-500 animate-pulse" />
                    </div>
                </div>
            </div>
        }>
            <FileManager />
        </Suspense>
    );
}

function FileManager() {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentFolderId = searchParams.get("folderId");

    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [folders, setFolders] = useState<Folder[]>([]);
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [isPending, startTransition] = useTransition();

    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const [shareLink, setShareLink] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();
            if (currentFolderId && !debouncedSearch) {
                queryParams.append("folderId", currentFolderId);
            }
            if (debouncedSearch) {
                queryParams.append("search", debouncedSearch);
            }

            const [foldersRes, filesRes] = await Promise.all([
                axios.get(`/api/folder?${queryParams.toString()}`),
                axios.get(`/api/storage?${queryParams.toString()}`),
            ]);
            setFolders(foldersRes.data.folders);
            setFiles(filesRes.data.files);
        } catch (error) {
            toast.error("Failed to load files and folders");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentFolderId, debouncedSearch]);

    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return;
        startTransition(async () => {
            try {
                await axios.post("/api/folder", { name: newFolderName, parentId: currentFolderId || null });
                toast.success("Folder created");
                setNewFolderName("");
                setIsFolderDialogOpen(false);
                fetchData();
            } catch (error) {
                toast.error("Failed to create folder");
            }
        });
    };

    const handleUploadFile = async () => {
        if (!uploadFile) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", uploadFile);
            const type = uploadFile.type.startsWith("image/") ? "image" : "file";
            formData.append("type", type);
            if (currentFolderId) formData.append("folderId", currentFolderId);

            await axios.post("/api/storage", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            toast.success("File uploaded successfully");
            setUploadFile(null);
            setIsUploadDialogOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleShare = async (fileId: string) => {
        try {
            const res = await axios.post("/api/share", { storageId: fileId });
            setShareLink(res.data.shareUrl);
            toast.success("Share link generated!");
        } catch (error) {
            toast.error("Failed to generate share link");
        }
    };

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

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto">
            {/* Top Bar */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/50">
                <div className="flex items-center gap-4">
                    {currentFolderId && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => router.back()}
                            className="h-10 w-10 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50"
                        >
                            <ArrowLeft size={18} />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            {debouncedSearch ? "Search Results" : "My Files"}
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            {folders.length + files.length} items in total
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Search Field */}
                    <div className="relative group min-w-[300px]">
                        <div className="absolute inset-0 bg-violet-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-violet-400 transition-colors w-4.5 h-4.5" />
                        <Input
                            placeholder="Find files or folders..."
                            className="pl-11 h-11 bg-slate-800/40 border-slate-700/50 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 rounded-xl text-slate-200"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 pr-4 border-r border-slate-800/50">
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white rounded-xl">
                            <Bell size={20} />
                        </Button>
                        
                        <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white rounded-xl">
                                    <Plus size={20} />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-800">
                                <DialogHeader>
                                    <DialogTitle className="text-white">Create New Folder</DialogTitle>
                                    <DialogDescription className="text-slate-400">
                                        Organize your files into a new directory.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Input
                                        placeholder="Folder name"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        className="bg-slate-800 border-slate-700 text-white focus:ring-violet-500"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsFolderDialogOpen(false)} className="text-slate-400 hover:text-white">Cancel</Button>
                                    <Button onClick={handleCreateFolder} disabled={isPending || !newFolderName.trim()} className="bg-violet-600 hover:bg-violet-500">
                                        Create
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-11 px-6 gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/20 border-none rounded-xl">
                                <UploadCloud size={18} />
                                <span className="hidden sm:inline">Upload</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-slate-800">
                            <DialogHeader>
                                <DialogTitle className="text-white">Upload File</DialogTitle>
                                <DialogDescription className="text-slate-400">
                                    Upload an image or document to your secure cloud storage.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Input
                                    type="file"
                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                    className="bg-slate-800 border-slate-700 text-white cursor-pointer"
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => { setIsUploadDialogOpen(false); setUploadFile(null); }} className="text-slate-400 hover:text-white">Cancel</Button>
                                <Button onClick={handleUploadFile} disabled={uploading || !uploadFile} className="bg-violet-600 hover:bg-violet-500">
                                    Start Upload
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Avatar className="h-10 w-10 border border-slate-700 p-[1px]">
                        <AvatarImage src={session?.user?.image || ""} />
                        <AvatarFallback className="bg-slate-800 text-violet-400 font-bold">
                            {session?.user?.name?.[0] || "U"}
                        </AvatarFallback>
                    </Avatar>
                </div>
            </header>

            {/* View Toggle & Stats */}
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

                {shareLink && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm"
                    >
                        <Share2 size={16} />
                        <span>Link ready: <a href={shareLink} target="_blank" className="underline font-medium">Open link</a></span>
                        <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(shareLink); toast.success("Copied!"); }} className="h-7 hover:bg-emerald-500/20 text-emerald-400">
                            Copy
                        </Button>
                    </motion.div>
                )}
            </div>

            {loading ? (
                <div className="h-[40vh] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-12 w-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
                        <p className="text-slate-500 animate-pulse font-medium">Organizing your digital life...</p>
                    </div>
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    {folders.length === 0 && files.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="h-[50vh] flex flex-col items-center justify-center text-center p-12 bg-slate-800/20 border border-dashed border-slate-700/50 rounded-[32px]"
                        >
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-violet-500/20 blur-3xl rounded-full" />
                                <div className="relative p-8 bg-slate-900 border border-slate-800 rounded-3xl text-slate-500">
                                    <FolderOpen size={64} className="stroke-[1.5]" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Your storage is peaceful</h3>
                            <p className="text-slate-400 max-w-sm mx-auto mb-8">
                                Looks like this folder is empty. Drop your first file here to get started with OptiFlow.
                            </p>
                            <Button 
                                onClick={() => setIsUploadDialogOpen(true)}
                                className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-8 py-6 rounded-2xl gap-3 transition-all hover:scale-105 active:scale-95"
                            >
                                <Plus size={20} />
                                Start Uploading
                            </Button>
                        </motion.div>
                    ) : (
                        <motion.div 
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className={cn(
                                "grid gap-6",
                                viewMode === "grid" 
                                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                                    : "grid-cols-1"
                            )}
                        >
                            {/* Render Folders */}
                            {folders.map(folder => (
                                <motion.div 
                                    key={folder.id}
                                    variants={itemVariants}
                                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                    onClick={() => router.push(`/dashboard/files?folderId=${folder.id}`)}
                                    className="group cursor-pointer p-5 bg-slate-800/40 hover:bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl transition-all duration-300 shadow-xl shadow-black/5"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400 group-hover:bg-violet-500/20 transition-colors">
                                            <FolderIcon size={24} className="fill-violet-400/20" />
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 opacity-0 group-hover:opacity-100">
                                                    <MoreHorizontal size={18} />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 bg-slate-900 border-slate-800 text-slate-200">
                                                <DropdownMenuItem className="gap-2">Rename</DropdownMenuItem>
                                                <DropdownMenuItem className="gap-2">Move</DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-slate-800" />
                                                <DropdownMenuItem className="gap-2 text-rose-400">Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <h4 className="font-semibold text-white truncate text-lg">{folder.name}</h4>
                                    <div className="flex items-center justify-between mt-3">
                                        <span className="text-xs text-slate-500 font-medium">
                                            {folder._count.files} files • {folder._count.children} folders
                                        </span>
                                        <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">Folder</span>
                                    </div>
                                </motion.div>
                            ))}

                            {/* Render Files */}
                            {files.map(file => (
                                <motion.div 
                                    key={file.id}
                                    variants={itemVariants}
                                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                    className="group p-5 bg-slate-800/20 hover:bg-slate-800/40 backdrop-blur-md border border-slate-700/30 rounded-2xl transition-all duration-300"
                                >
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="p-3 bg-slate-900/50 rounded-xl group-hover:scale-110 transition-transform duration-300">
                                            {getFileIcon(file.mime_type)}
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white">
                                                    <MoreVertical size={18} />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-800 text-slate-200">
                                                <DropdownMenuLabel>File Options</DropdownMenuLabel>
                                                <DropdownMenuSeparator className="bg-slate-800" />
                                                <DropdownMenuItem className="gap-2" onClick={() => window.open(`/api/storage/${file.id}/download`, '_blank')}>
                                                    <Download size={14} /> Download
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="gap-2" onClick={() => handleShare(file.id)}>
                                                    <Share2 size={14} /> Create Share Link
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-slate-800" />
                                                <DropdownMenuItem className="gap-2 text-rose-400 focus:text-rose-400">
                                                    <Trash2 size={14} /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-white truncate text-sm" title={file.file_name}>
                                            {file.file_name.split('-').slice(5).join('-') || file.file_name}
                                        </h4>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                            <span>{formatBytes(file.file_size)}</span>
                                            <span>•</span>
                                            <span>{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-700/30 flex items-center justify-between">
                                        <div className="flex -space-x-2">
                                            <div className="w-6 h-6 rounded-full border border-slate-900 bg-violet-600 flex items-center justify-center text-[10px] font-bold">A</div>
                                        </div>
                                        <button className="text-[10px] font-bold uppercase tracking-wider text-violet-400 hover:text-violet-300 transition-colors">
                                            View Details
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}
