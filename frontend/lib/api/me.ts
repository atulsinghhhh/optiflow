import { authClient } from "./http";

export type Me = {
    id: string;
    email: string;
    name: string;
    storage_quota_bytes: number;
};

export async function getMe(): Promise<Me> {
    const res = await authClient.get<Me>("/me");
    return res.data;
}

export async function updateMe(payload: { name: string }): Promise<Me> {
    const res = await authClient.patch<Me>("/me", payload);
    return res.data;
}
