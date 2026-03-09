"use client";

import { useState, useEffect, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import {
    Folder as FolderIcon,
    FileIcon,
    UploadCloud,
    Plus,
    MoreVertical,
    Share2,
    Download,
    Trash2,
    FolderOpen,
    Search
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

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
            <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
            </div>
        }>
            <FileManager />
        </Suspense>
    );
}

function FileManager() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentFolderId = searchParams.get("folderId");

    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [folders, setFolders] = useState<Folder[]>([]);
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog states
    const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [isPending, startTransition] = useTransition();

    // Upload states
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    // Share link states
    const [shareLink, setShareLink] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
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
            if (currentFolderId) {
                formData.append("folderId", currentFolderId);
            }

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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        {currentFolderId && !debouncedSearch && (
                            <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-8 px-2">
                                ← Back
                            </Button>
                        )}
                        <h1 className="text-3xl font-bold tracking-tight">
                            {debouncedSearch ? `Search Results for "${debouncedSearch}"` : "My Files"}
                        </h1>
                    </div>
                    <p className="text-muted-foreground">Manage your documents, images, and folders.</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    {/* Search Field */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                            placeholder="Search your files..."
                            className="pl-9 bg-background/50 focus-visible:ring-violet-500"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {/* New Folder Dialog */}
                    <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
                        <DialogTrigger render={
                            <Button variant="outline" className="gap-2 border-border/50">
                                <Plus size={16} /> New Folder
                            </Button>
                        } />
                        <DialogContent className="sm:max-w-md bg-card/60 backdrop-blur-2xl border-border/50">
                            <DialogHeader>
                                <DialogTitle>Create New Folder</DialogTitle>
                                <DialogDescription>
                                    Organize your files into a new directory.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Input
                                    placeholder="Folder name"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    className="bg-background/50 focus-visible:ring-violet-500"
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsFolderDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreateFolder} disabled={isPending || !newFolderName.trim()}>
                                    {isPending ? "Creating..." : "Create"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Upload File Dialog */}
                    <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                        <DialogTrigger render={
                            <Button className="gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg">
                                <UploadCloud size={16} /> Upload File
                            </Button>
                        } />
                        <DialogContent className="sm:max-w-md bg-card/60 backdrop-blur-2xl border-border/50">
                            <DialogHeader>
                                <DialogTitle>Upload File</DialogTitle>
                                <DialogDescription>
                                    Upload an image or document to your secure cloud storage.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Input
                                    type="file"
                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                    className="bg-background/50 file:text-foreground file:bg-muted"
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => { setIsUploadDialogOpen(false); setUploadFile(null); }}>Cancel</Button>
                                <Button onClick={handleUploadFile} disabled={uploading || !uploadFile}>
                                    {uploading ? "Uploading..." : "Upload"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {shareLink && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Share2 size={18} />
                        <span className="text-sm font-medium">Link Generated:</span>
                        <a href={shareLink} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">{shareLink}</a>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(shareLink); toast.success("Copied!"); }}>
                        Copy
                    </Button>
                </div>
            )}

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
                </div>
            ) : (
                <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden shadow-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4 font-medium">Name</th>
                                <th className="px-6 py-4 font-medium hidden md:table-cell">Date Added</th>
                                <th className="px-6 py-4 font-medium hidden sm:table-cell">Size</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {folders.length === 0 && files.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                        <FolderOpen size={40} className="mx-auto mb-3 opacity-20" />
                                        This folder is empty. Upload a file to get started.
                                    </td>
                                </tr>
                            )}

                            {/* Render Folders */}
                            {folders.map(folder => (
                                <tr key={folder.id}
                                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                                    onClick={() => router.push(`/dashboard/files?folderId=${folder.id}`)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-violet-500/10 rounded-lg text-violet-500">
                                                <FolderIcon size={20} className="fill-violet-500/20" />
                                            </div>
                                            <span className="font-medium">{folder.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 hidden md:table-cell text-muted-foreground">
                                        {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
                                    </td>
                                    <td className="px-6 py-4 hidden sm:table-cell text-muted-foreground">
                                        —
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical size={16} />
                                        </Button>
                                    </td>
                                </tr>
                            ))}

                            {/* Render Files */}
                            {files.map(file => (
                                <tr key={file.id} className="hover:bg-muted/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3 max-w-[200px] sm:max-w-xs md:max-w-md">
                                            <div className="p-2 bg-fuchsia-500/10 rounded-lg text-fuchsia-500">
                                                <FileIcon size={20} />
                                            </div>
                                            <span className="font-medium truncate" title={file.file_name}>
                                                {file.file_name.split('-').slice(5).join('-') || file.file_name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 hidden md:table-cell text-muted-foreground">
                                        {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                                    </td>
                                    <td className="px-6 py-4 hidden sm:table-cell text-muted-foreground">
                                        {formatBytes(file.file_size)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger render={
                                                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreVertical size={16} />
                                                </Button>
                                            } />
                                            <DropdownMenuContent align="end" className="w-48 bg-card/80 backdrop-blur-xl border-border/50">
                                                <DropdownMenuGroup>
                                                    <DropdownMenuLabel>File Actions</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => window.open(`/api/storage/${file.id}/download`, '_blank')}>
                                                        <Download size={14} /> Download
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => handleShare(file.id)}>
                                                        <Share2 size={14} /> Create Share Link
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                                                        <Trash2 size={14} /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuGroup>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
