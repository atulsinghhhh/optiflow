import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { 
    FolderOpen, 
    Users2, 
    Trash2, 
    HardDrive, 
    LayoutDashboard,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({ children, }: { children: React.ReactNode; }) {
    const session = await auth();

    if (!session?.user) {
        redirect("/signin");
    }

    return (
        <div className="flex min-h-screen bg-[#0F172A] text-slate-200 selection:bg-violet-500/30">
            {/* Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-20 w-72 border-r border-slate-800/50 bg-[#0F172A]/80 backdrop-blur-xl">
                <div className="flex h-20 items-center px-8">
                    <Link href="/dashboard" className="flex items-center gap-3 font-bold text-2xl tracking-tight text-white group">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            OptiFlow
                        </span>
                    </Link>
                </div>

                <div className="px-4 py-8 space-y-8">
                    {/* Primary Nav */}
                    <nav className="space-y-1.5">
                        <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Menu</p>
                        {[
                            { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
                            { href: "/dashboard/files", label: "My Files", icon: FolderOpen },
                            { href: "/dashboard/shared", label: "Shared with me", icon: Users2 },
                            { href: "#", label: "Trash", icon: Trash2 },
                        ].map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 hover:bg-slate-800/50 hover:text-white transition-all duration-200 group"
                            >
                                <item.icon size={18} className="text-slate-500 group-hover:text-violet-400 transition-colors" />
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* User Section */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800/50 bg-[#0F172A]/50 backdrop-blur-md">
                    <div className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-slate-800/30 transition-colors cursor-pointer group">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500 p-[1px]">
                            <div className="h-full w-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white uppercase">
                                {session.user.name?.[0] ?? "U"}
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{session.user.name ?? "User"}</p>
                            <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
                        </div>
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
