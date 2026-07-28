import axios from "axios";

import { uploadClient } from "./http";
import type { FileRecord } from "./files";

export type PresignResponse = {
    file_id: string;
    upload_url: string;
    expires_at: string;
};

export async function presignUpload(payload: {
    name: string;
    size_bytes: number;
    mime_type: string;
    folder_id?: string;
}): Promise<PresignResponse> {
    const res = await uploadClient.post<PresignResponse>("/uploads/presign", payload);
    return res.data;
}

// presignNewVersion starts uploading a replacement for an existing file —
// name/folder are inherited server-side, only the bytes change.
export async function presignNewVersion(
    fileId: string,
    payload: { size_bytes: number; mime_type: string },
): Promise<PresignResponse> {
    const res = await uploadClient.post<PresignResponse>(`/uploads/${fileId}/versions/presign`, payload);
    return res.data;
}

// Deliberately a bare axios.put, not `uploadClient` — MinIO's auth is the
// presigned query signature itself. Routing this through the interceptor-
// bearing client would attach a bearer token MinIO doesn't expect, and risks
// a stray 401-refresh-retry against a request that was never authenticated
// that way in the first place.
export async function putFileToPresignedUrl(
    url: string,
    file: File,
    onProgress?: (percent: number) => void,
): Promise<void> {
    await axios.put(url, file, {
        headers: { "Content-Type": file.type || "application/octet-stream" },
        onUploadProgress: (event) => {
            if (!onProgress || !event.total) return;
            onProgress(Math.round((event.loaded / event.total) * 100));
        },
    });
}

export async function completeUpload(fileId: string): Promise<FileRecord> {
    const res = await uploadClient.post<FileRecord>(`/uploads/${fileId}/complete`);
    return res.data;
}

export type DownloadUrlResponse = {
    url: string;
    expires_at: string;
};

// NOTE: no chunked/resumable (tus) upload exists on the backend yet — this is
// a single presigned PUT, unsuitable for very large files over an unstable
// connection. Tracked as a backend follow-up in plan.md, not faked here.
export async function getDownloadUrl(
    fileId: string,
    variant?: "thumbnail",
): Promise<DownloadUrlResponse> {
    const res = await uploadClient.get<DownloadUrlResponse>(`/uploads/${fileId}/download-url`, {
        params: variant ? { variant } : undefined,
    });
    return res.data;
}
