"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiSessionBridge } from "@/lib/api/session-bridge";

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <SessionProvider>
            <QueryClientProvider client={queryClient}>
                <ApiSessionBridge />
                <TooltipProvider>
                    {children}
                </TooltipProvider>
            </QueryClientProvider>
        </SessionProvider>
    );
}
