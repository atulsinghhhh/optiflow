"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { GitHubIcon } from "@/components/ui/sign-in-flow-1";
import { CanvasRevealEffect } from "@/components/ui/sign-in-flow-1";

interface SignInPageProps {
    className?: string;
}


const SignInPage = ({ className }: SignInPageProps) => {
    const router = useRouter();

    // form state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGitHubLoading, setIsGitHubLoading] = useState(false);

    // canvas reveal animation state
    const [step, setStep] = useState<"form" | "success">("form");
    const [initialCanvasVisible, setInitialCanvasVisible] = useState(true);
    const [reverseCanvasVisible, setReverseCanvasVisible] = useState(false);

    // ── GitHub OAuth ─────────────────────────────────────────────────────────────
    const handleGitHub = async () => {
        setIsGitHubLoading(true);
        setError(null);
        await signIn("github", { callbackUrl: "/dashboard" });
        // browser will redirect; no need to set loading back
    };

    // ── Email + Password ──────────────────────────────────────────────────────────
    const handleCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (result?.error) {
            setError("Invalid email or password. Please try again.");
            setIsLoading(false);
        } else {
            // Trigger success animation, then redirect
            setReverseCanvasVisible(true);
            setTimeout(() => setInitialCanvasVisible(false), 50);
            setTimeout(() => {
                setStep("success");
                setTimeout(() => router.push("/dashboard"), 1200);
            }, 1800);
        }
    };

    return (
        <div className={cn("flex w-full flex-col min-h-screen bg-black relative", className)}>
            {/* ── Canvas Background ───────────────────────────────────────────── */}
            <div className="absolute inset-0 z-0">
                {initialCanvasVisible && (
                    <div className="absolute inset-0">
                        <CanvasRevealEffect
                            animationSpeed={3}
                            containerClassName="bg-black"
                            colors={[[255, 255, 255], [255, 255, 255]]}
                            dotSize={6}
                            reverse={false}
                        />
                    </div>
                )}
                {reverseCanvasVisible && (
                    <div className="absolute inset-0">
                        <CanvasRevealEffect
                            animationSpeed={4}
                            containerClassName="bg-black"
                            colors={[[255, 255, 255], [255, 255, 255]]}
                            dotSize={6}
                            reverse={true}
                        />
                    </div>
                )}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.9)_0%,_transparent_100%)]" />
                <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
            </div>

            {/* ── Content ─────────────────────────────────────────────────────── */}
            <div className="relative z-10 flex flex-col flex-1">

                <div className="flex flex-1 items-center justify-center px-4">
                    <div className="w-full max-w-sm mt-[80px]">
                        <AnimatePresence mode="wait">
                            {step === "form" ? (
                                <motion.div
                                    key="form"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className="space-y-6"
                                >
                                    {/* Heading */}
                                    <div className="text-center space-y-1">
                                        <h1 className="text-4xl font-bold tracking-tight text-white">Welcome back</h1>
                                        <p className="text-white/50 text-lg font-light">Sign in to OptiFlow</p>
                                    </div>

                                    {/* GitHub Button */}
                                    <button
                                        onClick={handleGitHub}
                                        disabled={isGitHubLoading || isLoading}
                                        className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 
                               text-white border border-white/15 rounded-xl py-3 px-4 
                               transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                               hover:border-white/30 active:scale-[0.98]"
                                    >
                                        {isGitHubLoading ? (
                                            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                            </svg>
                                        ) : (
                                            <GitHubIcon />
                                        )}
                                        <span className="text-sm font-medium">Continue with GitHub</span>
                                    </button>

                                    {/* Divider */}
                                    <div className="flex items-center gap-4">
                                        <div className="h-px bg-white/10 flex-1" />
                                        <span className="text-white/30 text-xs uppercase tracking-wider">or</span>
                                        <div className="h-px bg-white/10 flex-1" />
                                    </div>

                                    {/* Email + Password Form */}
                                    <form onSubmit={handleCredentials} className="space-y-3">
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center"
                                            >
                                                {error}
                                            </motion.div>
                                        )}

                                        <div>
                                            <input
                                                type="email"
                                                placeholder="Email address"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                                autoComplete="email"
                                                className="w-full bg-white/5 text-white placeholder-white/30 border border-white/10
                                   rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-white/30
                                   focus:bg-white/8 transition-all duration-200"
                                            />
                                        </div>

                                        <div>
                                            <input
                                                type="password"
                                                placeholder="Password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                autoComplete="current-password"
                                                className="w-full bg-white/5 text-white placeholder-white/30 border border-white/10
                                   rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-white/30
                                   focus:bg-white/8 transition-all duration-200"
                                            />
                                        </div>

                                        <motion.button
                                            type="submit"
                                            disabled={isLoading || isGitHubLoading || !email || !password}
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white 
                                 text-black font-semibold py-3 text-sm
                                 hover:bg-white/90 transition-all duration-200
                                 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                                        >
                                            {isLoading ? (
                                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                                </svg>
                                            ) : "Sign In"}
                                        </motion.button>
                                    </form>

                                    {/* Footer */}
                                    <p className="text-center text-sm text-white/40">
                                        Don&#39;t have an account?{" "}
                                        <Link href="/sign-up" className="text-white/70 hover:text-white transition-colors underline underline-offset-4">
                                            Sign up
                                        </Link>
                                    </p>

                                    <p className="text-xs text-white/25 text-center leading-relaxed">
                                        By continuing, you agree to our{" "}
                                        <Link href="#" className="underline hover:text-white/40 transition-colors">Terms</Link>
                                        {" "}and{" "}
                                        <Link href="#" className="underline hover:text-white/40 transition-colors">Privacy Policy</Link>.
                                    </p>
                                </motion.div>
                            ) : (
                                /* ── Success State ─────────────────────────────────────── */
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                    className="space-y-6 text-center"
                                >
                                    <div className="space-y-1">
                                        <h1 className="text-4xl font-bold tracking-tight text-white">You&#39;re in!</h1>
                                        <p className="text-white/50 text-lg font-light">Redirecting to dashboard…</p>
                                    </div>
                                    <motion.div
                                        initial={{ scale: 0.7, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                        className="py-8"
                                    >
                                        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-white to-white/70 flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignInPage;