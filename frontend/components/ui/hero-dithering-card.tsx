"use client";

import { ArrowRight, Upload } from "lucide-react";
import { useState, Suspense, lazy } from "react";
import Link from "next/link";

const Dithering = lazy(() =>
    import("@paper-design/shaders-react").then((mod) => ({ default: mod.Dithering }))
);

export function CTASection() {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <section className="py-16 w-full flex justify-center items-center px-4 md:px-6">
            <div
                className="w-full max-w-7xl relative"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="relative overflow-hidden rounded-[48px] border border-border bg-card shadow-sm min-h-[580px] flex flex-col items-center justify-center duration-500">
                    {/* Dithering shader background */}
                    <Suspense fallback={<div className="absolute inset-0 bg-muted/20" />}>
                        <div className="absolute inset-0 z-0 pointer-events-none opacity-40 dark:opacity-30 mix-blend-multiply dark:mix-blend-screen">
                            <Dithering
                                colorBack="#00000000"
                                colorFront="#7c3aed"
                                shape="warp"
                                type="4x4"
                                speed={isHovered ? 0.6 : 0.2}
                                className="size-full"
                                minPixelRatio={1}
                            />
                        </div>
                    </Suspense>

                    {/* Content */}
                    <div className="relative z-10 px-6 max-w-4xl mx-auto text-center flex flex-col items-center">
                        {/* Badge */}
                        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-400 backdrop-blur-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                            </span>
                            Smart Cloud Storage
                        </div>

                        {/* Headline */}
                        <h2 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-foreground mb-6 leading-[1.05]">
                            Your files,{" "}
                            <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                                delivered instantly.
                            </span>
                        </h2>

                        {/* Subtext */}
                        <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mb-12 leading-relaxed">
                            Store, analyze, and share files at any scale. OptiFlow gives your team real-time
                            insights, secure sharing links, and enterprise-grade reliability — in one place.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <Link href="/sign-up">
                                <button className="group relative inline-flex h-14 items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-10 text-base font-semibold text-white transition-all duration-300 hover:from-violet-500 hover:to-fuchsia-500 hover:scale-105 active:scale-95 hover:shadow-[0_0_40px_-8px_rgba(139,92,246,0.8)]">
                                    <Upload className="h-5 w-5 relative z-10" />
                                    <span className="relative z-10">Start for free</span>
                                    <ArrowRight className="h-5 w-5 relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
                                </button>
                            </Link>
                            <Link href="/signin">
                                <button className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-border/60 bg-background/50 px-10 text-base font-medium text-foreground backdrop-blur-md transition-all duration-200 hover:bg-muted/60 hover:border-border hover:scale-105 active:scale-95">
                                    Access Dashboard
                                </button>
                            </Link>
                        </div>

                        {/* Social proof */}
                        <p className="mt-10 text-sm text-muted-foreground/70">
                            Trusted by{" "}
                            <span className="text-foreground/80 font-medium">2,847+ teams</span>
                            {" "}managing their cloud storage with OptiFlow
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
