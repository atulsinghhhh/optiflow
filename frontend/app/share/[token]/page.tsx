"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download, FileIcon, Loader2, Lock, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicShare, getShareDownloadUrl } from "@/lib/api/shares";
import { ApiError } from "@/lib/api/http";

function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function SharedFilePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const [password, setPassword] = useState("");
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);

    const { data: share, isLoading, error } = useQuery({
        queryKey: ["public-share", token],
        queryFn: () => getPublicShare(token),
        retry: false,
    });

    const handleDownload = async () => {
        setDownloadError(null);
        setDownloading(true);
        try {
            const { url } = await getShareDownloadUrl(token, password || undefined);
            window.open(url, "_blank");
        } catch (err) {
            setDownloadError(err instanceof ApiError ? err.message : "Failed to build download link");
        } finally {
            setDownloading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    if (error || !share) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
                <Card className="max-w-md w-full border-border bg-card">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
                            <ShieldAlert size={24} />
                        </div>
                        <CardTitle>Link not found</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-muted-foreground text-sm">
                        {error instanceof ApiError ? error.message : "This share link is invalid, expired, or has reached its download limit."}
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <Link href="/">
                            <Button variant="outline">Return Home</Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
            <Card className="max-w-md w-full border-border bg-card">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                        <FileIcon size={24} />
                    </div>
                    <CardTitle className="truncate">{share.file_name}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {formatBytes(share.size_bytes)} &middot; {share.mime_type}
                    </p>

                    {share.requires_password && (
                        <div className="space-y-1.5 text-left">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <Lock size={12} /> This file is password protected
                            </label>
                            <Input
                                type="password"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    )}

                    {downloadError && <p className="text-xs text-destructive">{downloadError}</p>}
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button onClick={handleDownload} disabled={downloading} className="gap-2 px-8">
                        {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        Download
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
