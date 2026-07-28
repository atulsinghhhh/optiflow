import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

import { SERVICE_URLS } from "./config";
import { getAccessToken, refreshAccessToken } from "./token";

export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

function createServiceClient(baseURL: string): AxiosInstance {
    const instance = axios.create({ baseURL });

    instance.interceptors.request.use((config) => {
        const token = getAccessToken();
        if (token) {
            config.headers.set("Authorization", `Bearer ${token}`);
        }
        return config;
    });

    instance.interceptors.response.use(
        (res) => res,
        async (error: AxiosError<{ error?: string }>) => {
            const original = error.config as RetryableConfig | undefined;

            if (error.response?.status === 401 && original && !original._retried) {
                original._retried = true;
                try {
                    const newToken = await refreshAccessToken();
                    original.headers.set("Authorization", `Bearer ${newToken}`);
                    return instance(original);
                } catch {
                    // Refresh failed — fall through to the normalized error below;
                    // refreshAccessToken() already triggered onAuthFailure().
                }
            }

            const status = error.response?.status ?? 0;
            const message = error.response?.data?.error ?? error.message ?? "request failed";
            return Promise.reject(new ApiError(status, message));
        },
    );

    return instance;
}

export const authClient = createServiceClient(SERVICE_URLS.auth);
export const apiClient = createServiceClient(SERVICE_URLS.api);
export const uploadClient = createServiceClient(SERVICE_URLS.upload);
export const notifyClient = createServiceClient(SERVICE_URLS.notify);
