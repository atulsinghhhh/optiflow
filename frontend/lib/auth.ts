import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

// auth-svc: POST /login -> { access_token, refresh_token }. It returns no user
// info, so the only identity we can attach comes from the JWT's `user_id`
// claim (decoded, not verified — we already trust the response since it just
// came back over HTTPS from auth-svc itself).
const AUTH_SVC_URL = process.env.NEXT_PUBLIC_AUTH_SVC_URL ?? "http://localhost:8081";

declare module "next-auth" {
    interface User {
        accessToken?: string;
        refreshToken?: string;
    }
    interface Session {
        accessToken?: string;
        refreshToken?: string;
    }
}

type MeResponse = { id: string; email: string; name: string };

// auth-svc's /login response carries no user profile info at all — only
// tokens — so the display name shown everywhere in the app (sidebar, avatar
// fallback, profile page) has to come from a follow-up call to /me using the
// token we just got back. Without this, session.user.name is always empty.
async function fetchName(accessToken: string): Promise<string | undefined> {
    try {
        const res = await fetch(`${AUTH_SVC_URL}/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return undefined;
        const me: MeResponse = await res.json();
        return me.name;
    } catch {
        return undefined;
    }
}

const signInSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

type AuthSvcTokens = {
    access_token: string;
    refresh_token?: string;
};

function decodeUserId(accessToken: string): string | null {
    try {
        const payload = accessToken.split(".")[1];
        const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return typeof json.user_id === "string" ? json.user_id : null;
    } catch {
        return null;
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        // GitHub OAuth removed for now — auth-svc has no OAuth exchange endpoint
        // yet (only /signup, /login, /refresh with email+password). Re-add once
        // auth-svc supports issuing tokens for an OAuth-authenticated user.
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },

            async authorize(credentials) {
                const parsed = signInSchema.safeParse(credentials);
                if (!parsed.success) return null;
                const { email, password } = parsed.data;

                const res = await fetch(`${AUTH_SVC_URL}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                });
                if (!res.ok) return null;

                const tokens: AuthSvcTokens = await res.json();
                const userId = decodeUserId(tokens.access_token);
                if (!userId) return null;

                const name = await fetchName(tokens.access_token);

                return {
                    id: userId,
                    email,
                    name,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                };
            },
        }),
    ],

    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.name = user.name;
                token.accessToken = user.accessToken;
                token.refreshToken = user.refreshToken;
            }
            // Fired by the API client's session-bridge after it silently refreshes
            // an expired access token, so the new token survives a page reload.
            if (trigger === "update" && typeof session?.accessToken === "string") {
                token.accessToken = session.accessToken;
            }
            // Fired by the profile page after a successful PATCH /me, so the new
            // name shows up in the sidebar/avatar without a full re-login.
            if (trigger === "update" && typeof session?.name === "string") {
                token.name = session.name;
            }
            return token;
        },

        async session({ session, token }) {
            if (token?.id) {
                session.user.id = token.id as string;
            }
            if (typeof token.name === "string") {
                session.user.name = token.name;
            }
            if (typeof token.accessToken === "string") {
                session.accessToken = token.accessToken;
            }
            if (typeof token.refreshToken === "string") {
                session.refreshToken = token.refreshToken;
            }
            return session;
        },
    },

    pages: {
        signIn: "/signin",
    },

    session: {
        strategy: "jwt",
    },
});
