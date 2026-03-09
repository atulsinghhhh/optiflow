import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LayoutDashboard, FolderOpen } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { LogoutButton } from "@/components/logout-button";
export default async function DashboardLayout({ children, }: { children: React.ReactNode; }) {
    const session = await auth();

    if (!session?.user) {
        redirect("/signin");
    }



    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-20 w-64 border-r border-border bg-card">
                <div className="flex h-16 items-center px-6">
                    <div className="flex items-center gap-2 font-bold text-xl drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]">
                        <Image
                            src="/logo.png"
                            alt="OptiFlow Logo"
                            width={32}
                            height={32}
                            className="rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-600/20"
                        />
                        OptiFlow
                    </div>
                </div>

                <div className="px-4 py-6">
                    <nav className="space-y-2 text-sm font-medium">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-200 hover:translate-x-1"
                        >
                            <LayoutDashboard size={18} />
                            Analytics
                        </Link>
                        <Link
                            href="/dashboard/files"
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-200 hover:translate-x-1"
                        >
                            <FolderOpen size={18} />
                            My Files
                        </Link>
                    </nav>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                    <Separator className="mb-4" />
                    <div className="flex items-center justify-between px-2">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold truncate max-w-[140px]">{session.user.name ?? "User"}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{session.user.email}</span>
                        </div>
                        <LogoutButton />
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 ml-64 min-h-screen">
                <div className="h-full px-8 py-8 lg:px-12 w-full mx-auto max-w-[1600px]">
                    {children}
                </div>
            </main>
        </div>
    );
}
