"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { HardDrive, Loader2, Pencil, Save, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useFileStats } from "@/lib/hooks/use-files";
import { useMe, useUpdateMe } from "@/lib/hooks/use-me";
import { ApiError } from "@/lib/api/http";

function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function ProfilePage() {
    const { data: session, update: updateSession } = useSession();
    const { data: me, isLoading: meLoading } = useMe();
    const { data: stats, isLoading: statsLoading } = useFileStats();
    const updateMe = useUpdateMe();

    const [editing, setEditing] = useState(false);
    const [name, setName] = useState("");

    const startEditing = () => {
        setName(me?.name ?? "");
        setEditing(true);
    };

    const handleSave = () => {
        if (!name.trim()) return;
        updateMe.mutate(
            { name: name.trim() },
            {
                onSuccess: async (updated) => {
                    await updateSession({ name: updated.name });
                    toast.success("Profile updated");
                    setEditing(false);
                },
                onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to update profile"),
            },
        );
    };

    if (meLoading || statsLoading) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    const displayName = me?.name ?? session?.user?.name ?? "Unnamed User";

    return (
        <div className="max-w-4xl mx-auto space-y-10">
            {/* Header Banner */}
            <div className="relative rounded-3xl overflow-hidden bg-ink p-8 shadow-2xl md:p-12">
                <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/20 rounded-full blur-2xl" />

                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                    <Avatar className="w-32 h-32 border-4 border-ink-foreground/20 shadow-2xl">
                        <AvatarImage src={session?.user?.image ?? undefined} />
                        <AvatarFallback className="bg-card text-primary text-4xl font-bold">
                            {displayName[0] ?? "U"}
                        </AvatarFallback>
                    </Avatar>

                    <div className="space-y-2 flex-1">
                        {editing ? (
                            <div className="flex items-center gap-2 max-w-sm mx-auto md:mx-0">
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="bg-card/10 border-ink-foreground/20 text-ink-foreground text-2xl h-auto py-1"
                                    autoFocus
                                />
                                <Button size="icon" variant="ghost" className="text-ink-foreground shrink-0" onClick={handleSave} disabled={updateMe.isPending}>
                                    <Save size={18} />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-ink-foreground shrink-0"
                                    onClick={() => {
                                        setEditing(false);
                                        setName(me?.name ?? "");
                                    }}
                                >
                                    <X size={18} />
                                </Button>
                            </div>
                        ) : (
                            <h1 className="text-4xl font-extrabold text-ink-foreground tracking-tight flex items-center gap-3 justify-center md:justify-start">
                                {displayName}
                                <button
                                    onClick={startEditing}
                                    className="text-ink-foreground/50 hover:text-ink-foreground transition-colors"
                                    title="Edit name"
                                >
                                    <Pencil size={18} />
                                </button>
                            </h1>
                        )}
                        <p className="text-ink-foreground/80 font-medium">{me?.email ?? session?.user?.email}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-card border border-border rounded-3xl p-8 shadow-xl md:col-span-2">
                    <h3 className="text-xl font-bold text-foreground mb-6">Account</h3>
                    <dl className="space-y-4 text-sm">
                        <div className="flex justify-between border-b border-border pb-3">
                            <dt className="text-muted-foreground">Email</dt>
                            <dd className="font-medium text-foreground">{me?.email}</dd>
                        </div>
                        <div className="flex justify-between border-b border-border pb-3">
                            <dt className="text-muted-foreground">Name</dt>
                            <dd className="font-medium text-foreground">{me?.name}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Total files</dt>
                            <dd className="font-medium text-foreground">{stats?.total_files ?? 0}</dd>
                        </div>
                    </dl>
                </div>

                <div className="bg-card border border-border rounded-3xl p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/10 rounded-full blur-xl" />

                    <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                        <HardDrive size={20} className="text-primary" /> Storage Usage
                    </h3>

                    <div className="space-y-4">
                        <div className="flex items-end justify-between font-bold">
                            <span className="text-3xl text-foreground">{formatBytes(stats?.total_bytes ?? 0)}</span>
                            <span className="text-sm text-muted-foreground font-medium">
                                of {formatBytes(me?.storage_quota_bytes ?? 0)}
                            </span>
                        </div>
                        <Progress
                            value={
                                me?.storage_quota_bytes
                                    ? Math.min(100, ((stats?.total_bytes ?? 0) / me.storage_quota_bytes) * 100)
                                    : 0
                            }
                            className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">
                            {stats?.total_files ?? 0} files across your whole account.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
