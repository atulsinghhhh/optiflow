"use client";

import { Copy, Link2, Loader2, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { NotificationsPopover } from "@/components/notifications-popover";
import { NotYetAvailable } from "@/components/not-yet-available";
import { Button } from "@/components/ui/button";
import { useDeleteShare, useShares } from "@/lib/hooks/use-shares";
import { ApiError } from "@/lib/api/http";

function shareUrl(token: string) {
    if (typeof window === "undefined") return `/share/${token}`;
    return `${window.location.origin}/share/${token}`;
}

// "Shared with me" (directed user-to-user shares) was never built — only
// public token links exist on the backend (see plan.md). This page shows
// what the user actually created: their own outgoing share links.
export default function MyShareLinksPage() {
    const { data: shares = [], isLoading } = useShares();
    const deleteShare = useDeleteShare();

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
        <div className="space-y-8 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">My Share Links</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Public links you&apos;ve created from the file manager. Directed user-to-user sharing isn&apos;t built yet.
                    </p>
                </div>
                <NotificationsPopover />
            </header>

            {isLoading ? (
                <div className="h-[40vh] flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            ) : shares.length === 0 ? (
                <NotYetAvailable
                    icon={Link2}
                    title="No share links yet"
                    description="Create one from a file's options menu in My Files — it'll show up here."
                />
            ) : (
                <div className="space-y-3">
                    {shares.map((share) => (
                        <div
                            key={share.id}
                            className="flex items-center justify-between gap-4 p-4 bg-card border border-border rounded-2xl"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground truncate">{share.file_name}</p>
                                <p className="text-xs font-mono text-muted-foreground truncate mt-1">{shareUrl(share.token)}</p>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    {share.download_count}
                                    {share.max_downloads ? `/${share.max_downloads}` : ""} downloads ·{" "}
                                    {share.expires_at
                                        ? `expires ${formatDistanceToNow(new Date(share.expires_at), { addSuffix: true })}`
                                        : "never expires"}
                                    {share.requires_password ? " · password protected" : ""} · created{" "}
                                    {formatDistanceToNow(new Date(share.created_at), { addSuffix: true })}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleCopy(share.token)}>
                                    <Copy size={14} /> Copy
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleRevoke(share.id)}
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
