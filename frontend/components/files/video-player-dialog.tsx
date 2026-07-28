"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertCircle, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SERVICE_URLS } from "@/lib/api/config";
import { getAccessToken } from "@/lib/api/token";

// hls.js fetches the master playlist, every variant playlist, and every
// segment via its own XHR loader — all resolved as relative URLs against
// this same authenticated endpoint (see upload-svc's hlsAsset handler).
// xhrSetup attaches the same bearer token used everywhere else in the app to
// each of those requests, which is what lets a private, non-public-read
// MinIO bucket back HLS playback without presigning every segment.
export function VideoPlayerDialog({
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
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!open || !fileId) return;

        // Resetting per-attempt UI state (not derived from props) as an HLS load
        // kicks off — legitimate imperative work, not something to compute during
        // render.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(null);
        setLoading(true);
        const src = `${SERVICE_URLS.upload}/uploads/${fileId}/hls/master.m3u8`;
        const video = videoRef.current;
        if (!video) return;

        if (Hls.isSupported()) {
            const hls = new Hls({
                xhrSetup: (xhr) => {
                    const token = getAccessToken();
                    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
                },
            });
            hlsRef.current = hls;
            hls.on(Hls.Events.MANIFEST_PARSED, () => setLoading(false));
            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) setError("Could not load video stream.");
            });
            hls.loadSource(src);
            hls.attachMedia(video);

            return () => {
                hls.destroy();
                hlsRef.current = null;
            };
        }

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            // Safari has native HLS support but can't attach custom auth headers
            // to segment/manifest requests — token-in-query would leak into logs,
            // so this falls back to an honest error rather than faking playback.
            setError("Video preview isn't supported in this browser yet.");
            setLoading(false);
            return;
        }

        setError("Your browser doesn't support HLS playback.");
        setLoading(false);
    }, [open, fileId]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="truncate">{fileName}</DialogTitle>
                </DialogHeader>

                <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                    {loading && !error && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="animate-spin text-white/70" size={32} />
                        </div>
                    )}
                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 text-sm px-8 text-center">
                            <AlertCircle size={28} />
                            {error}
                        </div>
                    )}
                    <video ref={videoRef} controls className="w-full h-full" />
                </div>
            </DialogContent>
        </Dialog>
    );
}
