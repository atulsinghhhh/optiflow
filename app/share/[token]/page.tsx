"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import axios from "axios";
import { Download, FileIcon, Loader2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

type SharedFileData = {
    token: string;
    file: {
        id: string;
        name: string;
        size: number;
        mimeType: string;
        fileType: string;
    };
    sharedBy: string;
    expiresAt: string | null;
    createdAt: string;
    downloadUrl: string;
    previewUrl: string;
};

export default function SharedFilePage() {
    const params = useParams();
    const router = useRouter();
    const [data, setData] = useState<SharedFileData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchShare() {
            if (!params?.token) return;
            try {
                const res = await axios.get(`/api/share/${params.token}`);
                setData(res.data);
            } catch (err: any) {
                if (err.response?.status === 410) {
                    setError("This share link has expired and is no longer available.");
                } else if (err.response?.status === 404) {
                    setError("This share link does not exist.");
                } else {
                    setError("An error occurred while fetching the shared file.");
                }
            } finally {
                setLoading(false);
            }
        }
        fetchShare();
    }, [params?.token]);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="animate-spin text-violet-500" size={32} />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background via-background to-destructive/10 px-4">
                <Card className="max-w-md w-full border-destructive/20 bg-background/50 backdrop-blur-xl">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
                            <AlertCircle size={24} />
                        </div>
                        <CardTitle>Link Unavailable</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-muted-foreground">
                        {error}
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <Button variant="outline" onClick={() => router.push("/")}>Return Home</Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    const isExpired = data.expiresAt ? new Date() > new Date(data.expiresAt) : false;

    return (
        <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background via-background to-violet-950/20 px-4 py-12">
            <div className="absolute inset-0 bg-grid-white/5 bg-[size:30px_30px] opacity-20 [mask-image:linear-gradient(to_bottom,white,transparent)]" />

            <div className="relative z-10 w-full max-w-lg animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center mb-8">
                    <Image
                        src="/logo.png"
                        alt="OptiFlow Logo"
                        width={48}
                        height={48}
                        className="mx-auto rounded-2xl shadow-lg mb-4 bg-gradient-to-br from-violet-500/20 to-fuchsia-600/20"
                    />
                    <h1 className="text-2xl font-bold">Shared with you</h1>
                    <p className="text-muted-foreground mt-1">
                        {data.sharedBy} has shared a file with you via OptiFlow.
                    </p>
                </div>

                <Card className="border-border/50 bg-card/60 backdrop-blur-2xl shadow-2xl overflow-hidden">
                    {data.file.fileType === "IMAGE" && data.previewUrl && (
                        <div className="w-full h-64 sm:h-80 bg-black/5 dark:bg-black/20 border-b border-border/50 overflow-hidden relative flex items-center justify-center">
                            <img src={data.previewUrl} alt={data.file.name} className="max-w-full max-h-full object-contain" />
                        </div>
                    )}
                    <CardHeader className="bg-muted/30 border-b border-border/50 pb-6">
                        <div className="flex items-start gap-4">
                            {!(data.file.fileType === "IMAGE" && data.previewUrl) && (
                                <div className="h-16 w-16 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-500 shrink-0">
                                    <FileIcon size={32} />
                                </div>
                            )}
                            <div className="overflow-hidden flex-1">
                                <CardTitle className="truncate text-xl mb-1" title={data.file.name}>
                                    {data.file.name.split('-').slice(5).join('-') || data.file.name}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-2 text-sm mt-2">
                                    <span className="font-medium bg-background px-2 py-0.5 rounded-md border border-border/50">{formatBytes(data.file.size)}</span>
                                    <span>•</span>
                                    <span>{data.file.fileType}</span>
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-6">
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-border/50">
                                <span className="text-muted-foreground">Original format</span>
                                <span className="font-medium">{data.file.mimeType}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border/50">
                                <span className="text-muted-foreground">Shared securely on</span>
                                <span className="font-medium">{new Date(data.createdAt).toLocaleDateString()}</span>
                            </div>
                            {data.expiresAt && (
                                <div className="flex justify-between items-center py-2 border-b border-border/50">
                                    <span className="text-muted-foreground flex items-center gap-1"><Clock size={14} /> Expires in</span>
                                    <span className={`font-medium ${isExpired ? 'text-destructive' : 'text-amber-500'}`}>
                                        {formatDistanceToNow(new Date(data.expiresAt))}
                                    </span>
                                </div>
                            )}
                        </div>
                    </CardContent>

                    <CardFooter className="pt-2 pb-6">
                        <Button
                            className="w-full h-12 text-md gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg transition-all active:scale-[0.98]"
                            onClick={() => window.open(data.downloadUrl, "_blank")}
                            disabled={isExpired}
                        >
                            <Download size={18} />
                            {isExpired ? "Link Expired" : "Download Securely"}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
