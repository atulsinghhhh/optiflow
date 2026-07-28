"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    Folder as FolderIcon,
    UploadCloud,
    Plus,
    MoreVertical,
    Share2,
    Download,
    Trash2,
    FolderOpen,
    Search,
    Grid,
    List as ListIcon,
    ArrowLeft,
    Image as ImageIcon,
    FileText,
    Video,
    Music,
    MoreHorizontal,
    Edit2,
    FileIcon,
    History,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { NotificationsPopover } from "@/components/notifications-popover";
import { UploadDialog } from "@/components/files/upload-dialog";
import { ShareDialog } from "@/components/files/share-dialog";
import { VideoPlayerDialog } from "@/components/files/video-player-dialog";
import { VersionHistoryDialog } from "@/components/files/version-history-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { useCreateFolder, useDeleteFolder, useFolders, useUpdateFolder } from "@/lib/hooks/use-folders";
import { useDeleteFile, useFileDownloadUrl, useFiles, useUpdateFile } from "@/lib/hooks/use-files";
import type { Folder } from "@/lib/api/folders";
import type { FileRecord, FileStatus } from "@/lib/api/files";
import { getDownloadUrl } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/http";

export default function FileManagerPage() {
    return (
        <Suspense
            fallback={
                <div className="h-[60vh] flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                </div>
            }
        >
            <FileManager />
        </Suspense>
    );
}

function getFileIcon(mime: string) {
    if (mime.startsWith("image/")) return <ImageIcon className="text-primary" size={20} />;
    if (mime.startsWith("video/")) return <Video className="text-accent" size={20} />;
    if (mime.startsWith("audio/")) return <Music className="text-accent" size={20} />;
    if (mime.includes("pdf") || mime.includes("word")) return <FileText className="text-primary" size={20} />;
    return <FileIcon className="text-muted-foreground" size={20} />;
}

function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const statusStyles: Record<FileStatus, string> = {
    pending: "bg-muted text-muted-foreground",
    processing: "bg-warning/15 text-warning animate-pulse",
    ready: "bg-success/15 text-success",
    failed: "bg-destructive/15 text-destructive",
};

function StatusBadge({ status }: { status: FileStatus }) {
    return (
        <span className={cn("px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md", statusStyles[status])}>
            {status}
        </span>
    );
}

function FileThumbnail({ file }: { file: FileRecord }) {
    const hasThumbnail = file.status !== "pending" && !!file.thumbnail_key;
    const { data } = useFileDownloadUrl(hasThumbnail ? file.id : null, "thumbnail");

    if (!data) {
        return (
            <div className="mb-4 aspect-video rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                {getFileIcon(file.mime_type)}
            </div>
        );
    }

    return (
        <div className="mb-4 aspect-video rounded-xl overflow-hidden bg-muted border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
    );
}

function FileManager() {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentFolderId = searchParams.get("folderId") ?? undefined;

    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [searchQuery, setSearchQuery] = useState("");

    const { data: folders = [], isLoading: foldersLoading } = useFolders(currentFolderId);
    const { data: files = [], isLoading: filesLoading } = useFiles(currentFolderId);
    const { data: rootFolders = [] } = useFolders(undefined);
    const loading = foldersLoading || filesLoading;

    const filteredFolders = useMemo(() => {
        if (!searchQuery.trim()) return folders;
        const q = searchQuery.toLowerCase();
        return folders.filter((f) => f.name.toLowerCase().includes(q));
    }, [folders, searchQuery]);

    const filteredFiles = useMemo(() => {
        if (!searchQuery.trim()) return files;
        const q = searchQuery.toLowerCase();
        return files.filter((f) => f.name.toLowerCase().includes(q));
    }, [files, searchQuery]);

    const createFolder = useCreateFolder();
    const updateFolder = useUpdateFolder();
    const deleteFolder = useDeleteFolder();
    const updateFile = useUpdateFile();
    const deleteFile = useDeleteFile();

    const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

    const [renameFolder, setRenameFolder] = useState<{ id: string; name: string } | null>(null);
    const [moveFolder, setMoveFolder] = useState<Folder | null>(null);
    const [moveTarget, setMoveTarget] = useState<string>("");
    const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

    const [renameFile, setRenameFile] = useState<{ id: string; name: string } | null>(null);
    const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
    const [shareFile, setShareFile] = useState<{ id: string; name: string } | null>(null);
    const [playFile, setPlayFile] = useState<{ id: string; name: string } | null>(null);
    const [versionsFile, setVersionsFile] = useState<{ id: string; name: string } | null>(null);

    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return;
        createFolder.mutate(
            { name: newFolderName, parent_id: currentFolderId },
            {
                onSuccess: () => {
                    toast.success("Folder created");
                    setNewFolderName("");
                    setIsFolderDialogOpen(false);
                },
                onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to create folder"),
            },
        );
    };

    const handleRenameFolder = () => {
        if (!renameFolder || !renameFolder.name.trim()) return;
        updateFolder.mutate(
            { id: renameFolder.id, payload: { name: renameFolder.name } },
            {
                onSuccess: () => {
                    toast.success("Folder renamed");
                    setRenameFolder(null);
                },
                onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to rename folder"),
            },
        );
    };

    const handleMoveFolder = () => {
        if (!moveFolder) return;
        updateFolder.mutate(
            { id: moveFolder.id, payload: { parent_id: moveTarget === "root" ? null : moveTarget } },
            {
                onSuccess: () => {
                    toast.success("Folder moved");
                    setMoveFolder(null);
                },
                onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to move folder"),
            },
        );
    };

    const handleDeleteFolder = () => {
        if (!deleteFolderId) return;
        deleteFolder.mutate(deleteFolderId, {
            onSuccess: () => {
                toast.success("Folder deleted");
                setDeleteFolderId(null);
            },
            onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to delete folder"),
        });
    };

    const handleRenameFile = () => {
        if (!renameFile || !renameFile.name.trim()) return;
        updateFile.mutate(
            { id: renameFile.id, payload: { name: renameFile.name } },
            {
                onSuccess: () => {
                    toast.success("File renamed");
                    setRenameFile(null);
                },
                onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to rename file"),
            },
        );
    };

    const handleDeleteFile = () => {
        if (!deleteFileId) return;
        deleteFile.mutate(deleteFileId, {
            onSuccess: () => {
                toast.success("File deleted");
                setDeleteFileId(null);
            },
            onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to delete file"),
        });
    };

    const handleDownload = async (fileId: string) => {
        try {
            const { url } = await getDownloadUrl(fileId);
            window.open(url, "_blank");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to build download link");
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
    };
    const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Top Bar */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
                <div className="flex items-center gap-4">
                    {currentFolderId && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                            className="h-10 w-10 rounded-xl bg-muted hover:bg-secondary border border-border"
                        >
                            <ArrowLeft size={18} />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            {searchQuery ? "Search Results" : "My Files"}
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            {filteredFolders.length + filteredFiles.length} items
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative group min-w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4.5 h-4.5" />
                        <Input
                            placeholder="Find files or folders..."
                            className="pl-11 h-11 rounded-xl"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 pr-4 border-r border-border">
                        <NotificationsPopover />

                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground rounded-xl cursor-pointer"
                            onClick={() => setIsFolderDialogOpen(true)}
                        >
                            <Plus size={20} />
                        </Button>
                        <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create New Folder</DialogTitle>
                                    <DialogDescription>Organize your files into a new directory.</DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Input
                                        placeholder="Folder name"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                    />
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsFolderDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCreateFolder}
                                        disabled={createFolder.isPending || !newFolderName.trim()}
                                    >
                                        Create
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Button
                        className="h-11 px-6 gap-2 rounded-xl cursor-pointer"
                        onClick={() => setIsUploadDialogOpen(true)}
                    >
                        <UploadCloud size={18} />
                        <span className="hidden sm:inline">Upload</span>
                    </Button>
                    <UploadDialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen} folderId={currentFolderId} />

                    <div onClick={() => router.push("/dashboard/profile")} className="cursor-pointer">
                        <Avatar className="h-10 w-10 border border-border p-px hover:scale-105 transition-transform">
                            <AvatarImage src={session?.user?.image ?? undefined} />
                            <AvatarFallback className="bg-muted text-primary font-bold">
                                {session?.user?.name?.[0] ?? "U"}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                </div>
            </header>

            {/* View Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex bg-muted p-1 rounded-xl border border-border">
                    <Button
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                        className="h-8 px-3 gap-2 rounded-lg"
                    >
                        <Grid size={16} /> Grid
                    </Button>
                    <Button
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                        className="h-8 px-3 gap-2 rounded-lg"
                    >
                        <ListIcon size={16} /> List
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="h-[40vh] flex items-center justify-center">
                    <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    {filteredFolders.length === 0 && filteredFiles.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="h-[50vh] flex flex-col items-center justify-center text-center p-12 bg-muted/40 border border-dashed border-border rounded-3xl"
                        >
                            <div className="relative p-8 bg-card border border-border rounded-3xl text-muted-foreground mb-6">
                                <FolderOpen size={64} className="stroke-[1.5]" />
                            </div>
                            <h3 className="text-2xl font-bold text-foreground mb-2">Your storage is peaceful</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto mb-8">
                                Looks like this folder is empty. Drop your first file here to get started.
                            </p>
                            <Button onClick={() => setIsUploadDialogOpen(true)} className="px-8 py-6 rounded-2xl gap-3">
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
                                viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1",
                            )}
                        >
                            {filteredFolders.map((folder) => (
                                <motion.div
                                    key={folder.id}
                                    variants={itemVariants}
                                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                    onClick={() => router.push(`/dashboard/files?folderId=${folder.id}`)}
                                    className="group cursor-pointer p-5 bg-card hover:bg-secondary border border-border rounded-2xl transition-all duration-300"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:bg-primary/20 transition-colors">
                                            <FolderIcon size={24} />
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100">
                                                    <MoreHorizontal size={18} />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenuItem onClick={() => setRenameFolder({ id: folder.id, name: folder.name })}>
                                                    Rename
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setMoveFolder(folder);
                                                        setMoveTarget("root");
                                                    }}
                                                >
                                                    Move
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteFolderId(folder.id)}>
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <h4 className="font-semibold text-foreground truncate text-lg">{folder.name}</h4>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
                                    </p>
                                </motion.div>
                            ))}

                            {filteredFiles.map((file) => (
                                <motion.div
                                    key={file.id}
                                    variants={itemVariants}
                                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                    className="group p-5 bg-card hover:bg-secondary border border-border rounded-2xl transition-all duration-300"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="p-3 bg-muted rounded-xl group-hover:scale-110 transition-transform duration-300">
                                            {getFileIcon(file.mime_type)}
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                    <MoreVertical size={18} />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56">
                                                <DropdownMenuLabel>File Options</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {file.mime_type.startsWith("video/") && file.playlist_key && (
                                                    <DropdownMenuItem onClick={() => setPlayFile({ id: file.id, name: file.name })}>
                                                        <Video size={14} /> Play
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    disabled={file.status !== "ready"}
                                                    onClick={() => handleDownload(file.id)}
                                                >
                                                    <Download size={14} /> Download
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setRenameFile({ id: file.id, name: file.name })}>
                                                    <Edit2 size={14} /> Rename
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={file.status !== "ready"}
                                                    onClick={() => setShareFile({ id: file.id, name: file.name })}
                                                >
                                                    <Share2 size={14} /> Create Share Link
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setVersionsFile({ id: file.id, name: file.name })}>
                                                    <History size={14} /> Version History
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteFileId(file.id)}>
                                                    <Trash2 size={14} /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    {file.mime_type.startsWith("image/") && <FileThumbnail file={file} />}

                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-foreground truncate text-sm" title={file.name}>
                                            {file.name}
                                        </h4>
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                                            <StatusBadge status={file.status} />
                                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary font-bold rounded-md">v{file.version}</span>
                                            <span>{formatBytes(file.size_bytes)}</span>
                                            <span>{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* Rename Folder Dialog */}
            <Dialog open={!!renameFolder} onOpenChange={(open) => !open && setRenameFolder(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Folder</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={renameFolder?.name ?? ""}
                            onChange={(e) => setRenameFolder((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRenameFolder(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRenameFolder} disabled={updateFolder.isPending || !renameFolder?.name.trim()}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Move Folder Dialog */}
            <Dialog open={!!moveFolder} onOpenChange={(open) => !open && setMoveFolder(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move &quot;{moveFolder?.name}&quot;</DialogTitle>
                        <DialogDescription>Choose a top-level destination folder, or move it to the root.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <select
                            value={moveTarget}
                            onChange={(e) => setMoveTarget(e.target.value)}
                            className="w-full h-10 rounded-lg border border-border bg-card text-foreground px-3 text-sm"
                        >
                            <option value="root">Root (no folder)</option>
                            {rootFolders
                                .filter((f) => f.id !== moveFolder?.id)
                                .map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.name}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setMoveFolder(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleMoveFolder} disabled={updateFolder.isPending}>
                            Move
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Folder Dialog */}
            <Dialog open={!!deleteFolderId} onOpenChange={(open) => !open && setDeleteFolderId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <Trash2 size={18} /> Delete Folder
                        </DialogTitle>
                        <DialogDescription>
                            This deletes the folder and everything inside it, recursively. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeleteFolderId(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteFolder} disabled={deleteFolder.isPending}>
                            Delete Permanently
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename File Dialog */}
            <Dialog open={!!renameFile} onOpenChange={(open) => !open && setRenameFile(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename File</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={renameFile?.name ?? ""}
                            onChange={(e) => setRenameFile((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRenameFile(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRenameFile} disabled={updateFile.isPending || !renameFile?.name.trim()}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete File Dialog */}
            <Dialog open={!!deleteFileId} onOpenChange={(open) => !open && setDeleteFileId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <Trash2 size={18} /> Confirm Deletion
                        </DialogTitle>
                        <DialogDescription>Are you sure you want to delete this file? This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="ghost" onClick={() => setDeleteFileId(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteFile} disabled={deleteFile.isPending}>
                            Delete Permanently
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ShareDialog
                open={!!shareFile}
                onOpenChange={(open) => !open && setShareFile(null)}
                fileId={shareFile?.id ?? null}
                fileName={shareFile?.name ?? ""}
            />

            <VideoPlayerDialog
                open={!!playFile}
                onOpenChange={(open) => !open && setPlayFile(null)}
                fileId={playFile?.id ?? null}
                fileName={playFile?.name ?? ""}
            />

            <VersionHistoryDialog
                open={!!versionsFile}
                onOpenChange={(open) => !open && setVersionsFile(null)}
                fileId={versionsFile?.id ?? null}
                fileName={versionsFile?.name ?? ""}
            />
        </div>
    );
}
