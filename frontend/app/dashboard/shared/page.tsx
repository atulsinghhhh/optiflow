"use client";

import { Share2 } from "lucide-react";
import { NotificationsPopover } from "@/components/notifications-popover";
import { NotYetAvailable } from "@/components/not-yet-available";

// TODO(share-backend): no Share model or endpoints exist on the backend yet
// (see plan.md's v1 reconciliation note) — this page is a placeholder, not
// wired to real data.
export default function SharedWithMePage() {
    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Shared with me</h1>
                    <p className="text-muted-foreground text-sm mt-1">Files others have shared with you</p>
                </div>
                <NotificationsPopover />
            </header>

            <NotYetAvailable
                icon={Share2}
                title="Sharing isn't available yet"
                description="The backend doesn't have a Share model or endpoints yet, so there's nothing to show here. Tracked in plan.md."
            />
        </div>
    );
}
