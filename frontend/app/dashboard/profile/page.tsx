"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { HardDrive, Loader2, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotYetAvailable } from "@/components/not-yet-available";
import { useFiles } from "@/lib/hooks/use-files";
import type { FileRecord } from "@/lib/api/files";

function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// TODO(profile-endpoints): auth-svc only issues {id, email} via the JWT — it
// has no GET/PATCH /me, so there's nothing to edit here yet. See plan.md.
export default function ProfilePage() {
    const { data: session } = useSession();
    // Reuses the same root-level derivation as the dashboard overview page —
    // api-svc has no recursive "all files" endpoint yet.
    const { data: files = [], isLoading } = useFiles(undefined);

    const stats = useMemo(() => {
        const totalBytes = files.reduce((sum: number, f: FileRecord) => sum + f.size_bytes, 0);
        return { fileCount: files.length, totalBytes };
    }, [files]);

    if (isLoading) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-10">
            {/* Header Banner */}
            <div className="relative rounded-3xl overflow-hidden bg-ink p-8 shadow-2xl md:p-12">
                <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/20 rounded-full blur-2xl" />

                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                    <Avatar className="w-32 h-32 border-4 border-ink-foreground/20 shadow-2xl">
                        <AvatarImage src={session?.user?.image ?? undefined} />
                        <AvatarFallback className="bg-card text-primary text-4xl font-bold">
                            {session?.user?.name?.[0] ?? "U"}
                        </AvatarFallback>
                    </Avatar>

                    <div className="space-y-2 flex-1">
                        <h1 className="text-4xl font-extrabold text-ink-foreground tracking-tight">
                            {session?.user?.name ?? "Unnamed User"}
                        </h1>
                        <p className="text-ink-foreground/80 font-medium">{session?.user?.email}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <NotYetAvailable
                        icon={User}
                        title="Profile editing"
                        description="auth-svc doesn't expose an endpoint to update your name, avatar, or bio yet — this is read-only for now."
                    />
                </div>

                <div className="bg-card border border-border rounded-3xl p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/10 rounded-full blur-xl" />

                    <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                        <HardDrive size={20} className="text-primary" /> Storage Usage
                    </h3>

                    <div className="space-y-4">
                        <div className="flex items-end justify-between font-bold">
                            <span className="text-3xl text-foreground">{formatBytes(stats.totalBytes)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats.fileCount} files in your root folder. Quota isn&apos;t enforced yet, and nested folders
                            aren&apos;t counted here — see plan.md.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
