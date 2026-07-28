import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as tus from "tus-js-client";

import { SERVICE_URLS } from "@/lib/api/config";
import { getAccessToken } from "@/lib/api/token";

export type UploadStatus = "uploading" | "done" | "error";

export type UploadItem = {
    id: string;
    file: File;
    progress: number;
    status: UploadStatus;
    error?: string;
};

let uploadCounter = 0;

// Uploads go through upload-svc's tus (resumable) endpoint rather than a
// single presigned PUT — a dropped connection on a large file resumes from
// wherever it left off instead of restarting from zero. onBeforeRequest reads
// the access token fresh on every request/retry (not just once at start),
// since an upload can easily outlive a 15-minute access token.
export function useFileUpload(folderId?: string) {
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const queryClient = useQueryClient();

    const patchUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    }, []);

    const startUpload = useCallback(
        (file: File) => {
            const id = `upload-${++uploadCounter}`;
            setUploads((prev) => [...prev, { id, file, progress: 0, status: "uploading" }]);

            const upload = new tus.Upload(file, {
                endpoint: `${SERVICE_URLS.upload}/uploads/tus/`,
                retryDelays: [0, 1000, 3000, 5000, 10000],
                metadata: {
                    filename: file.name,
                    filetype: file.type || "application/octet-stream",
                    folder_id: folderId ?? "",
                },
                onBeforeRequest: (req) => {
                    const token = getAccessToken();
                    if (token) req.setHeader("Authorization", `Bearer ${token}`);
                },
                onProgress: (bytesSent, bytesTotal) => {
                    patchUpload(id, { progress: Math.round((bytesSent / bytesTotal) * 100) });
                },
                onSuccess: () => {
                    patchUpload(id, { status: "done", progress: 100 });
                    // tus reports success as soon as the bytes are fully transferred,
                    // but upload-svc's finalization (pushing the assembled file into
                    // MinIO and creating its File row) happens asynchronously right
                    // after that — there's a brief window where an immediate refetch
                    // won't see the new file yet. A couple of delayed refetches close
                    // that window without needing a dedicated "is it done yet?" endpoint.
                    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["files", folderId ?? "root"] });
                    invalidate();
                    setTimeout(invalidate, 1500);
                    setTimeout(invalidate, 4000);
                },
                onError: (error) => {
                    patchUpload(id, { status: "error", error: error.message || "Upload failed" });
                },
            });

            upload.start();
        },
        [folderId, patchUpload, queryClient],
    );

    const dismissUpload = useCallback((id: string) => {
        setUploads((prev) => prev.filter((u) => u.id !== id));
    }, []);

    return { uploads, startUpload, dismissUpload };
}
