"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, FileIcon, ImageIcon, Music, UploadCloud, Video, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/lib/hooks/use-upload";

function getFileIcon(mime: string) {
    if (mime.startsWith("image/")) return <ImageIcon className="text-primary" size={20} />;
    if (mime.startsWith("video/")) return <Video className="text-accent" size={20} />;
    if (mime.startsWith("audio/")) return <Music className="text-accent" size={20} />;
    return <FileIcon className="text-muted-foreground" size={20} />;
}

function formatSize(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function UploadDialog({
    open,
    onOpenChange,
    folderId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folderId?: string;
}) {
    const { uploads, startUpload, dismissUpload } = useFileUpload(folderId);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback(
        (files: FileList | File[]) => {
            Array.from(files).forEach((file) => startUpload(file));
        },
        [startUpload],
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Upload files</DialogTitle>
                    <DialogDescription>
                        Files upload directly to storage with a presigned URL — nothing passes through the app server.
                    </DialogDescription>
                </DialogHeader>

                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                        "relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300",
                        isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/40 hover:border-primary/50",
                    )}
                >
                    <div className="relative p-8 flex flex-col items-center justify-center text-center gap-3">
                        <div className="p-4 rounded-2xl bg-card border border-border">
                            <UploadCloud size={28} className={isDragging ? "text-primary" : "text-muted-foreground"} />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                                {isDragging ? "Drop your files here" : "Drag & drop files to upload"}
                            </p>
                            <p className="text-muted-foreground text-xs">or click to browse</p>
                        </div>
                    </div>
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    />
                </div>

                {uploads.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        <AnimatePresence initial={false}>
                            {uploads.map((upload) => (
                                <motion.div
                                    key={upload.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="p-3 bg-muted/60 border border-border rounded-xl"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-card rounded-lg border border-border shrink-0">
                                            {getFileIcon(upload.file.type)}
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-medium text-foreground truncate">{upload.file.name}</p>
                                                <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                                                    {formatSize(upload.file.size)}
                                                </span>
                                            </div>

                                            {(upload.status === "uploading" || upload.status === "presigning") && (
                                                <Progress value={upload.progress} className="h-1.5" />
                                            )}

                                            {upload.status === "completing" && (
                                                <p className="text-[10px] text-muted-foreground">Finishing up…</p>
                                            )}

                                            {upload.status === "done" && (
                                                <div className="flex items-center gap-1.5 text-success text-[10px] font-semibold">
                                                    <CheckCircle2 size={12} /> Uploaded
                                                </div>
                                            )}

                                            {upload.status === "error" && (
                                                <div className="flex items-center gap-1.5 text-destructive text-[10px] font-semibold">
                                                    <AlertCircle size={12} /> {upload.error ?? "Upload failed"}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => dismissUpload(upload.id)}
                                            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                <div className="flex justify-end">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
