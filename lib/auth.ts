import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
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
        Credentials({
            // These fields appear on the default Auth.js sign-in page
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },

            async authorize(credentials) {
                // 1. Validate the incoming credentials with Zod
                const parsed = signInSchema.safeParse(credentials);
                if (!parsed.success) {
                    // Returning null tells Auth.js the sign-in failed
                    return null;
                }

                const { email, password } = parsed.data;

                // 2. Look up the user by email
                const user = await prisma.user.findUnique({ where: { email } });
                if (!user) return null;

                // 3. Compare the submitted password against the stored hash
                const passwordMatch = await bcrypt.compare(password, user.password);
                if (!passwordMatch) return null;

                // 4. Return the user object Auth.js will encode into the JWT/session
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name ?? user.username ?? null,
                };
            },
        }),
    ],

    // Persist user id in the JWT so we can use it in API routes
    callbacks: {
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
        // You can create a custom sign-in page later at /sign-in
        signIn: "/signin",
    },

    session: {
        strategy: "jwt",
    },
});
