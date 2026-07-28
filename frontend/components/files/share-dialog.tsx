"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useCreateShare, useDeleteShare, useFileShares } from "@/lib/hooks/use-shares";
import { ApiError } from "@/lib/api/http";
import { formatDistanceToNow } from "date-fns";

const EXPIRY_OPTIONS = [
    { label: "Never", value: "never" },
    { label: "1 hour", value: "1" },
    { label: "24 hours", value: "24" },
    { label: "7 days", value: "168" },
    { label: "30 days", value: "720" },
];

function shareUrl(token: string) {
    if (typeof window === "undefined") return `/share/${token}`;
    return `${window.location.origin}/share/${token}`;
}

export function ShareDialog({
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
    const [expiresIn, setExpiresIn] = useState("never");
    const [password, setPassword] = useState("");
    const [maxDownloads, setMaxDownloads] = useState("");

    const { data: shares = [], isLoading } = useFileShares(fileId);
    const createShare = useCreateShare();
    const deleteShare = useDeleteShare();

    const handleCreate = () => {
        if (!fileId) return;
        createShare.mutate(
            {
                fileId,
                payload: {
                    expires_in_hours: expiresIn === "never" ? undefined : Number(expiresIn),
                    password: password.trim() || undefined,
                    max_downloads: maxDownloads.trim() ? Number(maxDownloads) : undefined,
                },
            },
            {
                onSuccess: () => {
                    toast.success("Share link created");
                    setPassword("");
                    setMaxDownloads("");
                },
                onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to create share link"),
            },
        );
    };

    const handleCopy = async (token: string) => {
        await navigator.clipboard.writeText(shareUrl(token));
        toast.success("Link copied to clipboard");
    };

    const handleRevoke = (id: string) => {
        deleteShare.mutate(id, {
            onSuccess: () => toast.success("Share link revoked"),
            onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to revoke share link"),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 size={18} className="text-primary" /> Share &quot;{fileName}&quot;
                    </DialogTitle>
                    <DialogDescription>
                        Anyone with the link can view and download this file, subject to the limits you set below.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Expires</Label>
                        <select
                            value={expiresIn}
                            onChange={(e) => setExpiresIn(e.target.value)}
                            className="w-full h-9 rounded-lg border border-border bg-card text-foreground px-2 text-sm"
                        >
                            {EXPIRY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Password (optional)</Label>
                        <Input
                            type="password"
                            placeholder="None"
                            className="h-9"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Max downloads</Label>
                        <Input
                            type="number"
                            min={1}
                            placeholder="Unlimited"
                            className="h-9"
                            value={maxDownloads}
                            onChange={(e) => setMaxDownloads(e.target.value)}
                        />
                    </div>
                </div>

                <Button onClick={handleCreate} disabled={createShare.isPending || !fileId} className="w-full gap-2">
                    {createShare.isPending ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                    Create link
                </Button>

                <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active links</p>
                    {isLoading ? (
                        <div className="py-6 flex justify-center">
                            <Loader2 className="animate-spin text-muted-foreground" size={20} />
                        </div>
                    ) : shares.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No share links yet.</p>
                    ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {shares.map((share) => (
                                <div
                                    key={share.id}
                                    className="flex items-center justify-between gap-2 p-2.5 bg-muted/50 border border-border rounded-lg"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-mono truncate text-foreground">{shareUrl(share.token)}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {share.download_count}
                                            {share.max_downloads ? `/${share.max_downloads}` : ""} downloads
                                            {share.expires_at
                                                ? ` · expires ${formatDistanceToNow(new Date(share.expires_at), { addSuffix: true })}`
                                                : " · never expires"}
                                            {share.requires_password ? " · password protected" : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => handleCopy(share.token)}
                                        >
                                            <Copy size={14} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() => handleRevoke(share.id)}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
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
