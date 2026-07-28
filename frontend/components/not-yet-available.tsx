import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function NotYetAvailable({
    title,
    description,
    icon: Icon = Inbox,
}: {
    title: string;
    description: string;
    icon?: LucideIcon;
}) {
    return (
        <div className="h-[50vh] flex flex-col items-center justify-center text-center p-12 bg-muted/40 border border-dashed border-border rounded-3xl">
            <div className="p-8 bg-card border border-border rounded-3xl text-muted-foreground mb-6">
                <Icon size={64} className="stroke-[1.5]" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">{description}</p>
        </div>
    );
}
