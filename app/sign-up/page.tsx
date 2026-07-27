"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import axios from "axios";
import { ArrowLeft, Check } from "lucide-react";

/** Derives a clean username from an email address */
function deriveUsername(email: string): string {
    const local = email.split("@")[0] ?? "";
    return local
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 24);
}

const GitHubIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
);

const Spinner = ({ dark = false }: { dark?: boolean }) => (
    <svg className={cn("animate-spin w-4 h-4", dark ? "text-white" : "text-[#0A2540]")} viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
);

const inputCls =
    "w-full bg-white text-[#0A2540] placeholder-slate-400 border border-slate-200 " +
    "rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-[#635BFF] " +
    "focus:ring-2 focus:ring-[#635BFF]/20 transition-all duration-200";

export default function SignUpPage() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGitHubLoading, setIsGitHubLoading] = useState(false);
    const [step, setStep] = useState<"form" | "success">("form");

    useEffect(() => {
        setUsername(deriveUsername(email));
    }, [email]);

    const handleGitHub = async () => {
        setIsGitHubLoading(true);
        setError(null);
        await signIn("github", { callbackUrl: "/dashboard" });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await axios.post("/api/auth/signup", { email, password, name, username });
            setStep("success");
            setTimeout(() => router.push("/signin"), 1200);
        } catch (err: any) {
            setError(err.response?.data?.error ?? "Failed to create account. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-white px-4 py-16 overflow-hidden">
            {/* gradient mesh background, consistent with landing page */}
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-32 left-1/4 w-[30rem] h-[30rem] rounded-full bg-[#635BFF] opacity-15 blur-[120px]" />
                <div className="absolute -bottom-32 right-1/4 w-[26rem] h-[26rem] rounded-full bg-[#00A3FF] opacity-15 blur-[120px]" />
            </div>

            <Link
                href="/"
                className="absolute top-6 left-6 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#0A2540] transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to home
            </Link>

            <div className="w-full max-w-sm">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 p-8">
                    <AnimatePresence mode="wait">
                        {step === "form" ? (
                            <motion.div
                                key="form"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="space-y-6"
                            >
                                <div className="text-center space-y-1">
                                    <h1 className="text-2xl font-semibold tracking-tight text-[#0A2540]">Create account</h1>
                                    <p className="text-slate-500 text-sm">Join OptiFlow today</p>
                                </div>

                                <button
                                    onClick={handleGitHub}
                                    disabled={isGitHubLoading || isLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50
                             text-[#0A2540] border border-slate-200 rounded-lg py-2.5 px-4
                             transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                >
                                    {isGitHubLoading ? <Spinner /> : <GitHubIcon />}
                                    Continue with GitHub
                                </button>

                                <div className="flex items-center gap-4">
                                    <div className="h-px bg-slate-200 flex-1" />
                                    <span className="text-slate-400 text-xs uppercase tracking-wider">or</span>
                                    <div className="h-px bg-slate-200 flex-1" />
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-3">
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-center"
                                        >
                                            {error}
                                        </motion.div>
                                    )}

                                    <input
                                        type="text"
                                        placeholder="Full name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        autoComplete="name"
                                        className={inputCls}
                                    />

                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                        className={inputCls}
                                    />

                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none pointer-events-none">
                                            @
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="username"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                                            maxLength={24}
                                            className={cn(inputCls, "pl-8")}
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400 -mt-1 pl-1">
                                        Auto-generated from your email — you can change it
                                    </p>

                                    <input
                                        type="password"
                                        placeholder="Password (min. 6 characters)"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        autoComplete="new-password"
                                        className={inputCls}
                                    />

                                    <motion.button
                                        type="submit"
                                        disabled={isLoading || isGitHubLoading || !email || !password}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="w-full flex items-center justify-center gap-2 rounded-full bg-[#0A2540]
                               text-white font-semibold py-2.5 text-sm
                               hover:bg-[#0A2540]/90 transition-all duration-200
                               disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                                    >
                                        {isLoading ? <Spinner dark /> : "Create account"}
                                    </motion.button>
                                </form>

                                <p className="text-center text-sm text-slate-500">
                                    Already have an account?{" "}
                                    <Link href="/signin" className="text-[#635BFF] font-medium hover:underline">
                                        Sign in
                                    </Link>
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                className="space-y-6 text-center py-4"
                            >
                                <motion.div
                                    initial={{ scale: 0.7, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.4, delay: 0.1 }}
                                    className="mx-auto w-14 h-14 rounded-full bg-[#00B287]/10 flex items-center justify-center"
                                >
                                    <Check className="w-7 h-7 text-[#00B287]" />
                                </motion.div>
                                <div className="space-y-1">
                                    <h1 className="text-2xl font-semibold tracking-tight text-[#0A2540]">Account created!</h1>
                                    <p className="text-slate-500 text-sm">Taking you to sign in…</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <p className="text-xs text-slate-400 text-center leading-relaxed mt-6">
                    By creating an account you agree to our{" "}
                    <Link href="#" className="underline hover:text-slate-600 transition-colors">Terms</Link>
                    {" "}and{" "}
                    <Link href="#" className="underline hover:text-slate-600 transition-colors">Privacy Policy</Link>.
                </p>
            </div>
        </div>
    );
}
