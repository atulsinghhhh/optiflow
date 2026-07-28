"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";

import { configureApiClient, setTokens } from "./token";


export function ApiSessionBridge() {
    const { data: session, update } = useSession();

    useEffect(() => {
        setTokens({
            accessToken: session?.accessToken ?? null,
            refreshToken: session?.refreshToken ?? null,
        });
    }, [session?.accessToken, session?.refreshToken]);

    useEffect(() => {
        configureApiClient({
            onTokenRefreshed: (newAccessToken) => {
                void update({ accessToken: newAccessToken });
            },
            onAuthFailure: () => {
                void signOut({ callbackUrl: "/signin" });
            },
        });
    }, [update]);

    return null;
}
