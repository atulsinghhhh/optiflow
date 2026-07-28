export const SERVICE_URLS = {
    auth: process.env.NEXT_PUBLIC_AUTH_SVC_URL ?? "http://localhost:8081",
    api: process.env.NEXT_PUBLIC_API_SVC_URL ?? "http://localhost:8082",
    upload: process.env.NEXT_PUBLIC_UPLOAD_SVC_URL ?? "http://localhost:8083",
    notify: process.env.NEXT_PUBLIC_NOTIFY_SVC_URL ?? "http://localhost:8084",
} as const;
