import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { completeUpload, presignUpload, putFileToPresignedUrl } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/http";

export type UploadStatus = "presigning" | "uploading" | "completing" | "done" | "error";

export type UploadItem = {
    id: string;
    file: File;
    progress: number;
    status: UploadStatus;
    error?: string;
};

let uploadCounter = 0;

export function useFileUpload(folderId?: string) {
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const queryClient = useQueryClient();

    const patchUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    }, []);

    const startUpload = useCallback(
        (file: File) => {
            const id = `upload-${++uploadCounter}`;
            setUploads((prev) => [...prev, { id, file, progress: 0, status: "presigning" }]);

            (async () => {
                try {
                    const presigned = await presignUpload({
                        name: file.name,
                        size_bytes: file.size,
                        mime_type: file.type || "application/octet-stream",
                        folder_id: folderId,
                    });

                    patchUpload(id, { status: "uploading" });
                    await putFileToPresignedUrl(presigned.upload_url, file, (percent) =>
                        patchUpload(id, { progress: percent }),
                    );

                    patchUpload(id, { status: "completing", progress: 100 });
                    await completeUpload(presigned.file_id);

                    patchUpload(id, { status: "done" });
                    queryClient.invalidateQueries({ queryKey: ["files", folderId ?? "root"] });
                } catch (err) {
                    const message = err instanceof ApiError ? err.message : "Upload failed";
                    patchUpload(id, { status: "error", error: message });
                }
            })();
        },
        [folderId, patchUpload, queryClient],
    );

    const dismissUpload = useCallback((id: string) => {
        setUploads((prev) => prev.filter((u) => u.id !== id));
    }, []);

    return { uploads, startUpload, dismissUpload };
}
