
"use client";

import * as React from "react";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import { Menu, X, LogIn, UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const navItems = [
    { name: "Features", href: "#features" },
    { name: "Analytics", href: "#analytics" },
    { name: "Storage", href: "#storage" },
    { name: "Pricing", href: "#pricing" },
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
        <>
            <AnimatePresence>
                {!scrolled && (
                    <motion.header
                        key="fullbar"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-md"
                    >
                        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
                            {/* Logo */}
                            <Link href="/" className="flex items-center gap-2.5 group">
                                <Image
                                    src="/logo.png"
                                    alt="OptiFlow"
                                    width={32}
                                    height={32}
                                    className="rounded-xl drop-shadow-[0_0_10px_rgba(139,92,246,0.5)] transition-transform duration-200 group-hover:scale-105"
                                />
                                <span className="font-bold text-lg tracking-tight">OptiFlow</span>
                            </Link>

                            <nav className="hidden md:flex items-center gap-1">
                                {navItems.map((item) => (
                                    <a
                                        key={item.name}
                                        href={item.href}
                                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-full hover:bg-muted/60"
                                    >
                                        {item.name}
                                    </a>
                                ))}
                            </nav>
                            <div className="hidden md:flex items-center gap-3">
                                <Link
                                    href="/signin"
                                    className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-full hover:bg-muted/60"
                                >
                                    <LogIn className="h-4 w-4" />
                                    Sign In
                                </Link>
                                <Link
                                    href="/sign-up"
                                    className="flex items-center gap-1.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 px-5 py-2 rounded-full transition-all shadow-[0_0_16px_rgba(139,92,246,0.4)] hover:shadow-[0_0_24px_rgba(139,92,246,0.6)] hover:scale-105 active:scale-95"
                                >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Get Started
                                </Link>
                            </div>

                            <button
                                className="md:hidden p-2 rounded-full hover:bg-muted/60 transition-colors"
                                onClick={() => setMobileOpen((v) => !v)}
                            >
                                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </button>
                        </div>

                        <AnimatePresence>
                            {mobileOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                    className="overflow-hidden border-t border-border/30 bg-background/95 backdrop-blur-md"
                                >
                                    <div className="flex flex-col px-6 py-4 gap-3">
                                        {navItems.map((item) => (
                                            <a
                                                key={item.name}
                                                href={item.href}
                                                onClick={() => setMobileOpen(false)}
                                                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                                            >
                                                {item.name}
                                            </a>
                                        ))}
                                        <div className="border-t border-border/30 pt-3 flex flex-col gap-2">
                                            <Link href="/signin" className="text-sm font-medium text-center py-2.5 rounded-full border border-border/60 hover:bg-muted/60 transition-colors">
                                                Sign In
                                            </Link>
                                            <Link href="/sign-up" className="text-sm font-semibold text-center text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 rounded-full">
                                                Get Started
                                            </Link>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.header>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {scrolled && (
                    <motion.div
                        key="pill"
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ type: "spring", damping: 22, stiffness: 300 }}
                        className="fixed top-5 left-1/2 -translate-x-1/2 z-50"
                    >
                        <nav className="flex items-center gap-1 rounded-full border border-border/60 bg-background/85 shadow-[0_4px_32px_rgba(0,0,0,0.14)] backdrop-blur-md px-3 h-11">
                            <Link href="/" className="flex items-center gap-1.5 pr-2 mr-1 border-r border-border/50">
                                <Image
                                    src="/logo.png"
                                    alt="OptiFlow"
                                    width={22}
                                    height={22}
                                    className="rounded-md drop-shadow-[0_0_6px_rgba(139,92,246,0.5)]"
                                />
                                <span className="font-bold text-xs tracking-tight hidden sm:block">OptiFlow</span>
                            </Link>

                            {navItems.map((item) => (
                                <a
                                    key={item.name}
                                    href={item.href}
                                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-full hover:bg-muted/60 whitespace-nowrap hidden sm:block"
                                >
                                    {item.name}
                                </a>
                            ))}

                            <div className="w-px h-4 bg-border/50 mx-1" />
                            <Link
                                href="/signin"
                                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-full hover:bg-muted/60 whitespace-nowrap"
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/sign-up"
                                className="text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 px-3.5 py-1.5 rounded-full transition-all shadow-[0_0_10px_rgba(139,92,246,0.4)] hover:shadow-[0_0_16px_rgba(139,92,246,0.6)] whitespace-nowrap ml-0.5"
                            >
                                Get Started
                            </Link>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
