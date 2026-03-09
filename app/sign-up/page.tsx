"use client";

import { useTransition, useState } from "react";
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
import axios from "axios";

export default function SignUpPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;
        const name = formData.get("name") as string;
        const username = formData.get("username") as string;

        startTransition(async () => {
            try {
                await axios.post("/api/auth/signup", { email, password, name, username });
                toast.success("Account created successfully. Please sign in!");
                router.push("/signin");
            } catch (err: any) {
                setError(err.response?.data?.error || "Failed to create account.");
                toast.error("Registration failed.");
            }
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background via-background to-fuchsia-950/20 px-4 py-8">
            <div className="absolute inset-0 bg-grid-white/5 bg-[size:30px_30px] opacity-20 [mask-image:linear-gradient(to_bottom,white,transparent)]" />

            <div className="relative z-10 w-full max-w-md">
                <div className="flex flex-col items-center mb-8 gap-2">
                    <Image
                        src="/logo.png"
                        alt="OptiFlow Logo"
                        width={48}
                        height={48}
                        className="rounded-2xl drop-shadow-[0_0_20px_rgba(217,70,239,0.5)] bg-gradient-to-br from-violet-500/20 to-fuchsia-600/20"
                    />
                    <h1 className="text-3xl font-bold tracking-tight">Join OptiFlow</h1>
                    <p className="text-muted-foreground text-sm">Create an account to manage your files</p>
                </div>

                <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl">
                    <form onSubmit={onSubmit}>
                        <CardHeader>
                            <CardTitle>Sign Up</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-lg">
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        placeholder="John Doe"
                                        className="bg-background/50 focus-visible:ring-violet-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="username">Username</Label>
                                    <Input
                                        id="username"
                                        name="username"
                                        placeholder="johndoe"
                                        className="bg-background/50 focus-visible:ring-violet-500 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
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
                                <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    className="bg-background/50 focus-visible:ring-violet-500 transition-all"
                                />
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Min 6 characters</p>
                            </div>
                        </CardContent>

                        <CardFooter className="flex flex-col gap-4">
                            <Button
                                type="submit"
                                className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white shadow-lg transition-all active:scale-[0.98]"
                                disabled={isPending}
                            >
                                {isPending ? <Loader2 className="animate-spin" size={18} /> : "Create Account"}
                            </Button>
                            <p className="text-center text-sm text-muted-foreground w-full">
                                Already have an account?{" "}
                                <Link
                                    href="/signin"
                                    className="text-violet-400 hover:text-violet-300 transition-colors font-medium underline-offset-4 hover:underline"
                                >
                                    Sign in
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
