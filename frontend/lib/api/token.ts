import { SERVICE_URLS } from "./config";


type AuthCallbacks = {
    onTokenRefreshed: (accessToken: string) => void;
    onAuthFailure: () => void;
};

let accessToken: string | null = null;
let refreshToken: string | null = null;
let callbacks: AuthCallbacks | null = null;
let refreshPromise: Promise<string> | null = null;

type TokenListener = (token: string | null) => void;
const listeners = new Set<TokenListener>();

function notifyListeners() {
    listeners.forEach((listener) => listener(accessToken));
}

// Lets consumers outside the request/response cycle (e.g. the notification
// WebSocket, which must reconnect with a fresh token after a silent refresh)
// react to token changes without polling `useSession()`.
export function subscribeAccessToken(listener: TokenListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function setTokens(next: { accessToken: string | null; refreshToken: string | null }) {
    const changed = accessToken !== next.accessToken;
    accessToken = next.accessToken;
    refreshToken = next.refreshToken;
    if (changed) notifyListeners();
}

export function getAccessToken(): string | null {
    return accessToken;
}

export function configureApiClient(cb: AuthCallbacks) {
    callbacks = cb;
}

// De-duplicates concurrent refresh attempts: if three requests 401 at once,
// only one /refresh call goes out and all three retries wait on it.
export function refreshAccessToken(): Promise<string> {
    if (!refreshToken) {
        callbacks?.onAuthFailure();
        return Promise.reject(new Error("no refresh token available"));
    }

    if (!refreshPromise) {
        refreshPromise = fetch(`${SERVICE_URLS.auth}/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
        })
            .then(async (res) => {
                if (!res.ok) throw new Error("refresh failed");
                const data: { access_token: string } = await res.json();
                accessToken = data.access_token;
                notifyListeners();
                callbacks?.onTokenRefreshed(data.access_token);
                return data.access_token;
            })
            .catch((err) => {
                callbacks?.onAuthFailure();
                throw err;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
}
