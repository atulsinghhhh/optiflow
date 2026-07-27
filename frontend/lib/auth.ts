import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

// Zod schema for validating credentials at sign-in
const signInSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        GitHub({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
        }),
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },

            async authorize(credentials) {
                // 1. Validate the incoming credentials with Zod
                const parsed = signInSchema.safeParse(credentials);
                if (!parsed.success) return null;

                const { email, password } = parsed.data;

                // 2. Look up the user by email
                const user = await prisma.user.findUnique({ where: { email } });
                if (!user || !user.password) return null;

                // 3. Compare the submitted password against the stored hash
                const passwordMatch = await bcrypt.compare(password, user.password);
                if (!passwordMatch) return null;

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name ?? user.username ?? null,
                };
            },
        }),
    ],

    callbacks: {
        async signIn({ user, account }) {
            // For GitHub OAuth: upsert the user and link the account
            if (account?.provider === "github" && user.email) {
                const existingUser = await prisma.user.findUnique({
                    where: { email: user.email },
                });

                if (!existingUser) {
                    // Create a new user for first-time GitHub login
                    const newUser = await prisma.user.create({
                        data: {
                            email: user.email,
                            name: user.name ?? null,
                            accounts: {
                                create: {
                                    type: account.type,
                                    provider: account.provider,
                                    providerAccountId: account.providerAccountId,
                                    refresh_token: account.refresh_token ?? null,
                                    access_token: account.access_token ?? null,
                                    expires_at: account.expires_at ?? null,
                                    token_type: account.token_type ?? null,
                                    scope: account.scope ?? null,
                                    id_token: account.id_token ?? null,
                                    session_state: account.session_state as string ?? null,
                                },
                            },
                        },
                    });
                    // Inject our DB id so jwt callback gets it
                    user.id = newUser.id;
                } else {
                    // Link the GitHub account if not already linked
                    const linked = await prisma.account.findUnique({
                        where: {
                            provider_providerAccountId: {
                                provider: account.provider,
                                providerAccountId: account.providerAccountId,
                            },
                        },
                    });
                    if (!linked) {
                        await prisma.account.create({
                            data: {
                                userId: existingUser.id,
                                type: account.type,
                                provider: account.provider,
                                providerAccountId: account.providerAccountId,
                                refresh_token: account.refresh_token ?? null,
                                access_token: account.access_token ?? null,
                                expires_at: account.expires_at ?? null,
                                token_type: account.token_type ?? null,
                                scope: account.scope ?? null,
                                id_token: account.id_token ?? null,
                                session_state: account.session_state as string ?? null,
                            },
                        });
                    }
                    user.id = existingUser.id;
                }
            }
            return true;
        },

        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },

        async session({ session, token }) {
            if (token?.id) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },

    pages: {
        signIn: "/signin",
    },

    session: {
        strategy: "jwt",
    },
});
