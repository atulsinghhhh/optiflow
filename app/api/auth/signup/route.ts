import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const signupSchema = z.object({
    email: z.string().email("Please provide a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    name: z.string().optional(),
    username: z.string().optional(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const parsed = signupSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
                { status: 422 }
            );
        }

        const { email, password, name, username } = parsed.data;

        // Check for duplicate email
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json(
                { error: "An account with this email already exists" },
                { status: 409 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Create the user
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name ?? null,
                username: username ?? null,
            },
        });

        const { password: _pw, ...safeUser } = user;

        return NextResponse.json({ user: safeUser }, { status: 201 });
    } catch (error) {
        console.error("Error during signup:", error);
        return NextResponse.json({ error: "Error creating account" }, { status: 500 });
    }
}
