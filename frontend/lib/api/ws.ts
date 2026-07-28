import { SERVICE_URLS } from "./config";
import type { Notification } from "./notifications";

type SocketStatus = "connecting" | "open" | "closed";

type Handlers = {
    onMessage: (notification: Notification) => void;
    onStatusChange?: (status: SocketStatus) => void;
};

const MAX_BACKOFF_MS = 30_000;

// notify-svc's /ws can't read an Authorization header (browsers don't set
// custom headers on the WS handshake), so the access token travels as a
// query param instead — matches notify-svc's handler exactly.
export class NotificationSocket {
    private socket: WebSocket | null = null;
    private handlers: Handlers | null = null;
    private token: string | null = null;
    private reconnectAttempt = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private closedByCaller = false;

    connect(token: string, handlers: Handlers) {
        this.token = token;
        this.handlers = handlers;
        this.closedByCaller = false;
        this.reconnectAttempt = 0;
        this.open();
    }

    private open() {
        if (!this.token) return;
        this.clearReconnectTimer();

        const wsBase = SERVICE_URLS.notify.replace(/^http/, "ws");
        this.socket = new WebSocket(`${wsBase}/ws?token=${encodeURIComponent(this.token)}`);
        this.handlers?.onStatusChange?.("connecting");

        this.socket.onopen = () => {
            this.reconnectAttempt = 0;
            this.handlers?.onStatusChange?.("open");
        };

        this.socket.onmessage = (event) => {
            try {
                const notification: Notification = JSON.parse(event.data);
                this.handlers?.onMessage(notification);
            } catch {
                // Malformed push — drop it rather than crash the socket.
            }
        };

        this.socket.onclose = () => {
            this.handlers?.onStatusChange?.("closed");
            if (!this.closedByCaller) this.scheduleReconnect();
        };

        this.socket.onerror = () => {
            this.socket?.close();
        };
    }

    // Called when a token refresh rotates the access token mid-session — the
    // old connection's query-param token is now stale, so reconnect with the
    // new one rather than waiting for the server to reject it.
    reconnectWithToken(token: string) {
        this.token = token;
        if (this.closedByCaller) return;
        this.socket?.close();
    }

    close() {
        this.closedByCaller = true;
        this.clearReconnectTimer();
        this.socket?.close();
        this.socket = null;
    }

    private scheduleReconnect() {
        const delay = Math.min(1000 * 2 ** this.reconnectAttempt, MAX_BACKOFF_MS);
        this.reconnectAttempt += 1;
        this.reconnectTimer = setTimeout(() => this.open(), delay);
    }

    private clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
