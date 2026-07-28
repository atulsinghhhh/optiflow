"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, KeyRound } from "lucide-react";

import { requestPasswordReset } from "@/lib/api/password-reset";
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

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [resetToken, setResetToken] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            const { reset_token } = await requestPasswordReset(email);
            setResetToken(reset_token);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to start password reset");
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
                        {!resetToken ? (
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
                                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reset your password</h1>
                                    <p className="text-muted-foreground text-sm">
                                        Enter your account email and we&apos;ll get you a reset link.
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-3">
                                    {error && (
                                        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-center">
                                            {error}
                                        </div>
                                    )}

                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                        className={inputCls}
                                    />

                                    <motion.button
                                        type="submit"
                                        disabled={isLoading || !email}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="w-full flex items-center justify-center gap-2 rounded-full bg-ink
                                 text-ink-foreground font-semibold py-2.5 text-sm
                                 hover:bg-ink/90 transition-all duration-200
                                 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                                    >
                                        {isLoading ? <Spinner /> : "Send reset link"}
                                    </motion.button>
                                </form>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="dev-token"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="space-y-5 text-center"
                            >
                                <div className="mx-auto h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center text-warning">
                                    <KeyRound size={22} />
                                </div>
                                <div className="space-y-1">
                                    <h1 className="text-xl font-semibold tracking-tight text-foreground">Dev mode: no email sender yet</h1>
                                    <p className="text-muted-foreground text-sm">
                                        There&apos;s no email provider wired up, so here&apos;s your reset link directly.
                                        It expires in 30 minutes.
                                    </p>
                                </div>
                                <Link
                                    href={`/reset-password?token=${encodeURIComponent(resetToken)}`}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink
                             text-ink-foreground font-semibold py-2.5 text-sm hover:bg-ink/90 transition-all duration-200"
                                >
                                    Continue to reset password
                                </Link>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
