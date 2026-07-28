import { apiClient } from "./http";

export type FileStatus = "pending" | "processing" | "ready" | "failed";

export type FileRecord = {
    id: string;
    name: string;
    user_id: string;
    folder_id: string | null;
    size_bytes: number;
    mime_type: string;
    status: FileStatus;
    thumbnail_key: string | null;
    playlist_key: string | null;
    version: number;
    created_at: string;
    updated_at: string;
};

export async function listFiles(folderId?: string): Promise<FileRecord[]> {
    const res = await apiClient.get<FileRecord[]>("/files/", {
        params: folderId ? { folder_id: folderId } : undefined,
    });
    return res.data;
}

export async function getFile(id: string): Promise<FileRecord> {
    const res = await apiClient.get<FileRecord>(`/files/${id}`);
    return res.data;
}

export async function updateFile(
    id: string,
    payload: { name?: string; folder_id?: string | null },
): Promise<FileRecord> {
    const res = await apiClient.patch<FileRecord>(`/files/${id}`, {
        name: payload.name,
        folder_id: payload.folder_id === null ? "" : payload.folder_id,
    });
    return res.data;
}

export async function deleteFile(id: string): Promise<void> {
    await apiClient.delete(`/files/${id}`);
}

export type FileStats = {
    total_files: number;
    total_bytes: number;
    status_counts: Record<string, number>;
    type_counts: Record<string, number>;
};

// Account-wide aggregation across every folder — unlike listFiles, which only
// lists a single folder level at a time.
export async function getFileStats(): Promise<FileStats> {
    const res = await apiClient.get<FileStats>("/files/stats");
    return res.data;
}
