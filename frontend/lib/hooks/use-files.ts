import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteFile, getFile, listFiles, updateFile, type FileRecord } from "@/lib/api/files";
import { getDownloadUrl } from "@/lib/api/uploads";

const filesKey = (folderId?: string) => ["files", folderId ?? "root"] as const;

export function useFiles(folderId?: string) {
    return useQuery({
        queryKey: filesKey(folderId),
        queryFn: () => listFiles(folderId),
        // Files stuck in "processing" flip to "ready"/"failed" asynchronously via
        // image-worker/video-worker — poll while any are mid-flight so the UI
        // catches the transition without a manual refresh.
        refetchInterval: (query) => {
            const files = query.state.data as FileRecord[] | undefined;
            return files?.some((f) => f.status === "processing" || f.status === "pending") ? 3000 : false;
        },
    });
}

export function useFile(id: string | null) {
    return useQuery({
        queryKey: id ? ["file", id] : ["file", "none"],
        queryFn: () => getFile(id as string),
        enabled: !!id,
    });
}

export function useUpdateFile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: { name?: string; folder_id?: string | null } }) =>
            updateFile(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["files"] });
        },
    });
}

export function useDeleteFile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteFile(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["files"] });
        },
    });
}

export function useFileDownloadUrl(fileId: string | null, variant?: "thumbnail") {
    return useQuery({
        queryKey: ["download-url", fileId, variant ?? "original"],
        queryFn: () => getDownloadUrl(fileId as string, variant),
        enabled: !!fileId,
        // Presigned URLs are valid 15 minutes server-side; refetch well before
        // expiry rather than on every render.
        staleTime: 10 * 60 * 1000,
        retry: false,
    });
}
