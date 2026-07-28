import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listFileVersions, restoreFileVersion } from "@/lib/api/files";
import { completeUpload, presignNewVersion, putFileToPresignedUrl } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/http";

export function useFileVersions(fileId: string | null) {
    return useQuery({
        queryKey: ["file-versions", fileId ?? "none"],
        queryFn: () => listFileVersions(fileId as string),
        enabled: !!fileId,
    });
}

export function useRestoreFileVersion(fileId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (versionId: string) => restoreFileVersion(fileId as string, versionId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["file-versions", fileId ?? "none"] });
            queryClient.invalidateQueries({ queryKey: ["files"] });
        },
    });
}

export type VersionUploadState =
    | { status: "idle" }
    | { status: "uploading"; progress: number }
    | { status: "completing" }
    | { status: "error"; error: string };

// Mirrors useFileUpload's presign -> PUT -> complete flow, but against the
// versions/presign endpoint so the upload replaces fileId instead of
// creating an unrelated new file.
export function useUploadNewVersion(fileId: string | null) {
    const [state, setState] = useState<VersionUploadState>({ status: "idle" });
    const queryClient = useQueryClient();

    const upload = useCallback(
        async (file: File) => {
            if (!fileId) return;
            setState({ status: "uploading", progress: 0 });
            try {
                const presigned = await presignNewVersion(fileId, {
                    size_bytes: file.size,
                    mime_type: file.type || "application/octet-stream",
                });

                await putFileToPresignedUrl(presigned.upload_url, file, (percent) =>
                    setState({ status: "uploading", progress: percent }),
                );

                setState({ status: "completing" });
                await completeUpload(presigned.file_id);

                setState({ status: "idle" });
                queryClient.invalidateQueries({ queryKey: ["file-versions", fileId] });
                queryClient.invalidateQueries({ queryKey: ["files"] });
            } catch (err) {
                const message = err instanceof ApiError ? err.message : "Upload failed";
                setState({ status: "error", error: message });
            }
        },
        [fileId, queryClient],
    );

    return { state, upload };
}
