"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { History, Loader2, RotateCcw, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useFileVersions, useRestoreFileVersion, useUploadNewVersion } from "@/lib/hooks/use-file-versions";
import { ApiError } from "@/lib/api/http";

function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function VersionHistoryDialog({
    open,
    onOpenChange,
    fileId,
    fileName,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fileId: string | null;
    fileName: string;
}) {
    const { data: versions = [], isLoading } = useFileVersions(fileId);
    const restore = useRestoreFileVersion(fileId);
    const { state: uploadState, upload } = useUploadNewVersion(fileId);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleRestore = (versionId: string) => {
        restore.mutate(versionId, {
            onSuccess: () => toast.success("Version restored"),
            onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to restore version"),
        });
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void upload(file);
    };

    const uploading = uploadState.status === "uploading" || uploadState.status === "completing";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 truncate">
                        <History size={18} className="text-primary" /> Version history — {fileName}
                    </DialogTitle>
                    <DialogDescription>
                        Upload a new version to replace this file, or restore an older one.
                    </DialogDescription>
                </DialogHeader>

                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelected} />
                <Button
                    variant="outline"
                    className="w-full gap-2"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {uploadState.status === "completing" ? "Finishing up…" : "Upload new version"}
                </Button>
                {uploadState.status === "uploading" && <Progress value={uploadState.progress} className="h-1.5" />}
                {uploadState.status === "error" && (
                    <p className="text-xs text-destructive text-center">{uploadState.error}</p>
                )}

                <div className="space-y-2 pt-2 border-t border-border">
                    {isLoading ? (
                        <div className="py-6 flex justify-center">
                            <Loader2 className="animate-spin text-muted-foreground" size={20} />
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {versions.map((v) => (
                                <div
                                    key={v.id}
                                    className={cn(
                                        "flex items-center justify-between gap-3 p-3 rounded-lg border",
                                        v.is_current ? "bg-primary/5 border-primary/20" : "bg-muted/40 border-border",
                                    )}
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-foreground">v{v.version}</span>
                                            {v.is_current && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-1.5 py-0.5 rounded-md">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            {formatBytes(v.size_bytes)} · {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                                        </p>
                                    </div>
                                    {!v.is_current && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="gap-1.5 shrink-0"
                                            disabled={restore.isPending}
                                            onClick={() => handleRestore(v.id)}
                                        >
                                            <RotateCcw size={14} /> Restore
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
