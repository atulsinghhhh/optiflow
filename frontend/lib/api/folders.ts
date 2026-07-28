import { apiClient } from "./http";
import type { FileRecord } from "./files";

export type Folder = {
    id: string;
    name: string;
    user_id: string;
    parent_id: string | null;
    created_at: string;
    updated_at: string;
};

export type FolderDetail = Folder & {
    children: Folder[];
    files: FileRecord[];
};

export async function listFolders(parentId?: string): Promise<Folder[]> {
    const res = await apiClient.get<Folder[]>("/folders/", {
        params: parentId ? { parent_id: parentId } : undefined,
    });
    return res.data;
}

export async function getFolder(id: string): Promise<FolderDetail> {
    const res = await apiClient.get<FolderDetail>(`/folders/${id}`);
    return res.data;
}

export async function createFolder(payload: { name: string; parent_id?: string }): Promise<Folder> {
    const res = await apiClient.post<Folder>("/folders/", payload);
    return res.data;
}

export async function updateFolder(
    id: string,
    payload: { name?: string; parent_id?: string | null },
): Promise<Folder> {
    const res = await apiClient.patch<Folder>(`/folders/${id}`, {
        name: payload.name,
        parent_id: payload.parent_id === null ? "" : payload.parent_id,
    });
    return res.data;
}

export async function deleteFolder(id: string): Promise<void> {
    await apiClient.delete(`/folders/${id}`);
}
