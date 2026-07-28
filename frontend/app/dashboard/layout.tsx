import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
    FolderOpen,
    Users2,
    Trash2,
    LayoutDashboard,
    User,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({ children, }: { children: React.ReactNode; }) {
    const session = await auth();

    if (!session?.user) {
        redirect("/signin");
    }

    return (
        <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/20">
            {/* Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-20 w-72 border-r border-border bg-card/80 backdrop-blur-xl">
                <div className="flex h-20 items-center px-8">
                    <Link href="/dashboard" className="flex items-center gap-3 font-bold text-2xl tracking-tight text-foreground group">
                        <span className="text-primary">StreamVault</span>
                    </Link>
                </div>

                <div className="px-4 py-8 space-y-8">
                    {/* Primary Nav */}
                    <nav className="space-y-1.5">
                        <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Menu</p>
                        {[
                            { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
                            { href: "/dashboard/files", label: "My Files", icon: FolderOpen },
                            { href: "/dashboard/shared", label: "Share Links", icon: Users2 },
                            { href: "/dashboard/profile", label: "Profile", icon: User },
                        ].map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200 group"
                            >
                                <item.icon size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                {item.label}
                            </Link>
                        ))}
                        {/* Trash isn't wired up yet — no backend soft-delete/restore endpoint
                            exists. Shown disabled rather than a silent dead link. */}
                        <div
                            aria-disabled="true"
                            title="Trash isn't available yet"
                            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
                        >
                            <Trash2 size={18} className="text-muted-foreground/50" />
                            Trash
                            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">Soon</span>
                        </div>
                    </nav>
                </div>

                {/* User Section */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card/50 backdrop-blur-md">
                    <div className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-secondary transition-colors group">
                        <Link href="/dashboard/profile" className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-primary p-[1px] shrink-0">
                                <div className="h-full w-full rounded-full bg-card flex items-center justify-center text-xs font-bold text-foreground uppercase">
                                    {session.user.name?.[0] ?? "U"}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{session.user.name ?? "User"}</p>
                                <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                            </div>
                        </Link>
                        <LogoutButton />
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 ml-72 min-h-screen">
                <div className="h-full w-full p-8 lg:p-12">
                    {children}
                </div>
            </main>
        </div>
    );
}
