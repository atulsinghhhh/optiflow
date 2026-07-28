"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, KeyRound } from "lucide-react";

import { confirmPasswordReset } from "@/lib/api/password-reset";
import { ApiError } from "@/lib/api/http";

const Spinner = () => (
    <svg className="animate-spin w-4 h-4 text-ink-foreground" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
);

const inputCls =
    "w-full bg-card text-foreground placeholder-muted-foreground border border-border " +
    "rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-primary " +
    "focus:ring-2 focus:ring-primary/20 transition-all duration-200";

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [token, setToken] = useState(searchParams.get("token") ?? "");
    const [password, setPassword] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        if (password !== confirmPw) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);
        try {
            await confirmPasswordReset(token, password);
            setDone(true);
            setTimeout(() => router.push("/signin"), 1500);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to reset password");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-32 left-1/4 w-[30rem] h-[30rem] rounded-full bg-primary opacity-15 blur-[120px]" />
                <div className="absolute -bottom-32 right-1/4 w-[26rem] h-[26rem] rounded-full bg-accent opacity-15 blur-[120px]" />
            </div>

            <Link
                href="/signin"
                className="absolute top-6 left-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
            </Link>

            <div className="w-full max-w-sm">
                <div className="rounded-2xl border border-border bg-card shadow-xl p-8">
                    <AnimatePresence mode="wait">
                        {!done ? (
                            <motion.div
                                key="form"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="space-y-6"
                            >
                                <div className="text-center space-y-1">
                                    <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 text-primary">
                                        <KeyRound size={22} />
                                    </div>
                                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Set a new password</h1>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-3">
                                    {error && (
                                        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-center">
                                            {error}
                                        </div>
                                    )}

                                    <input
                                        type="text"
                                        placeholder="Reset token"
                                        value={token}
                                        onChange={(e) => setToken(e.target.value)}
                                        required
                                        className={inputCls}
                                    />
                                    <input
                                        type="password"
                                        placeholder="New password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                        className={inputCls}
                                    />
                                    <input
                                        type="password"
                                        placeholder="Confirm new password"
                                        value={confirmPw}
                                        onChange={(e) => setConfirmPw(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                        className={inputCls}
                                    />

                                    <motion.button
                                        type="submit"
                                        disabled={isLoading || !token || !password || !confirmPw}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="w-full flex items-center justify-center gap-2 rounded-full bg-ink
                                 text-ink-foreground font-semibold py-2.5 text-sm
                                 hover:bg-ink/90 transition-all duration-200
                                 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                                    >
                                        {isLoading ? <Spinner /> : "Reset password"}
                                    </motion.button>
                                </form>
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
                                    className="mx-auto w-14 h-14 rounded-full bg-success/10 flex items-center justify-center"
                                >
                                    <Check className="w-7 h-7 text-success" />
                                </motion.div>
                                <div className="space-y-1">
                                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Password reset</h1>
                                    <p className="text-muted-foreground text-sm">Redirecting you to sign in…</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={null}>
            <ResetPasswordForm />
        </Suspense>
    );
}
