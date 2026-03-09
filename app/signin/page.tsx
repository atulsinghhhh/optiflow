"use client";

import { useTransition, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function SignInPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        startTransition(async () => {
            try {
                const result = await signIn("credentials", {
                    email,
                    password,
                    redirect: false,
                });

                if (result?.error) {
                    setError("Invalid email or password");
                    toast.error("Sign in failed. Check your credentials.");
                } else {
                    toast.success("Signed in successfully!");
                    router.push("/dashboard");
                    router.refresh(); // Important: refresh data to ensure layout gets session
                }
            } catch (err) {
                setError("An unexpected error occurred.");
            }
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background via-background to-violet-950/20 px-4">
            <div className="absolute inset-0 bg-grid-white/5 bg-[size:30px_30px] opacity-20 [mask-image:linear-gradient(to_bottom,white,transparent)]" />

            <div className="relative z-10 w-full max-w-md">
                <div className="flex flex-col items-center mb-8 gap-2">
                    <Image
                        src="/logo.png"
                        alt="OptiFlow Logo"
                        width={48}
                        height={48}
                        className="rounded-2xl drop-shadow-[0_0_20px_rgba(139,92,246,0.6)] bg-gradient-to-br from-violet-500/20 to-fuchsia-600/20"
                    />
                    <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
                    <p className="text-muted-foreground text-sm">Sign in to your OptiFlow account</p>
                </div>

                <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl">
                    <form onSubmit={onSubmit}>
                        <CardHeader>
                            <CardTitle>Sign In</CardTitle>
                            <CardDescription>
                                Enter your credentials to access your dashboard.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-lg">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    required
                                    className="bg-background/50 focus-visible:ring-violet-500 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                </div>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    className="bg-background/50 focus-visible:ring-violet-500 transition-all"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button
                                type="submit"
                                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg transition-all active:scale-[0.98]"
                                disabled={isPending}
                            >
                                {isPending ? <Loader2 className="animate-spin" size={18} /> : "Sign In"}
                            </Button>
                            <p className="text-center text-sm text-muted-foreground w-full">
                                Don&apos;t have an account?{" "}
                                <Link
                                    href="/sign-up"
                                    className="text-violet-400 hover:text-violet-300 transition-colors font-medium underline-offset-4 hover:underline"
                                >
                                    Sign up
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
