"use client";

import * as React from "react";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import { Menu, X, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";

const navItems = [
    { name: "Files", href: "/dashboard/files" },
    { name: "Shared", href: "/dashboard/shared" },
];

export function AnimatedNavFramer() {
    const [scrolled, setScrolled] = React.useState(false);
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const { scrollY } = useScroll();

    useMotionValueEvent(scrollY, "change", (latest) => {
        setScrolled(latest > 80);
        if (latest > 80) setMobileOpen(false);
    });

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 border-b border-slate-800/50 transition-all duration-300 ${scrolled ? 'bg-[#0F172A]/90 backdrop-blur-xl h-16' : 'bg-transparent h-20'}`}>
            <div className="max-w-7xl mx-auto flex h-full items-center justify-between px-6">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <span className="font-bold text-xl tracking-tighter text-white uppercase italic">
                        OptiFlow
                    </span>
                </Link>

                <nav className="hidden md:flex items-center gap-8">
                    {navItems.map((item) => (
                        <a
                            key={item.name}
                            href={item.href}
                            className="text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                        >
                            {item.name}
                        </a>
                    ))}
                </nav>

                <div className="hidden md:flex items-center gap-6">
                    <Link
                        href="/signin"
                        className="text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                    >
                        Sign In
                    </Link>
                    <Link
                        href="/sign-up"
                        className="text-xs font-mono uppercase tracking-widest bg-white text-[#0F172A] px-4 py-2 hover:bg-slate-200 transition-colors font-bold"
                    >
                        Get Started
                    </Link>
                </div>

                <button
                    className="md:hidden p-2 text-white"
                    onClick={() => setMobileOpen((v) => !v)}
                >
                    {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-[#0F172A] border-b border-slate-800"
                    >
                        <div className="flex flex-col px-6 py-8 gap-6">
                            {navItems.map((item) => (
                                <a
                                    key={item.name}
                                    href={item.href}
                                    className="text-xs font-mono uppercase tracking-widest text-slate-400"
                                >
                                    {item.name}
                                </a>
                            ))}
                            <Link href="/signin" className="text-xs font-mono uppercase tracking-widest text-slate-400">
                                Sign In
                            </Link>
                            <Link href="/sign-up" className="text-xs font-mono uppercase tracking-widest text-white border border-slate-700 py-3 text-center">
                                Get Started
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
