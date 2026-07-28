import { apiClient, uploadClient } from "./http";

export type Share = {
    id: string;
    file_id: string;
    user_id: string;
    token: string;
    expires_at: string | null;
    max_downloads: number | null;
    download_count: number;
    created_at: string;
    file_name: string;
    requires_password: boolean;
};

export type CreateShareInput = {
    expires_in_hours?: number;
    password?: string;
    max_downloads?: number;
};

export async function createShare(fileId: string, payload: CreateShareInput): Promise<Share> {
    const res = await apiClient.post<Share>(`/files/${fileId}/shares`, payload);
    return res.data;
}

export async function listFileShares(fileId: string): Promise<Share[]> {
    const res = await apiClient.get<Share[]>(`/files/${fileId}/shares`);
    return res.data;
}

export async function listShares(): Promise<Share[]> {
    const res = await apiClient.get<Share[]>("/shares/");
    return res.data;
}

export async function deleteShare(id: string): Promise<void> {
    await apiClient.delete(`/shares/${id}`);
}

export type PublicShare = {
    file_name: string;
    size_bytes: number;
    mime_type: string;
    requires_password: boolean;
    has_thumbnail: boolean;
};

// Public — no auth token is required (or sent) for these two calls; the
// share token itself is the credential.
export async function getPublicShare(token: string): Promise<PublicShare> {
    const res = await apiClient.get<PublicShare>(`/shares/${token}`);
    return res.data;
}

export type ShareDownloadUrl = {
    url: string;
    expires_at: string;
};

export async function getShareDownloadUrl(token: string, password?: string): Promise<ShareDownloadUrl> {
    const res = await uploadClient.post<ShareDownloadUrl>(`/shares/${token}/download-url`, {
        password: password ?? "",
    });
    return res.data;
}
