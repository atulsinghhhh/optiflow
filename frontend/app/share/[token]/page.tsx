"use client";

import Link from "next/link";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// TODO(share-backend): no Share model or endpoints exist on the backend yet
// (see plan.md's v1 reconciliation note) — there's no token to validate
// against, so this route can't do anything but say so honestly.
export default function SharedFilePage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
            <Card className="max-w-md w-full border-border bg-card">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                        <Share2 size={24} />
                    </div>
                    <CardTitle>Sharing isn&apos;t available yet</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground text-sm">
                    Share links aren&apos;t wired up on the backend yet, so this link can&apos;t be resolved.
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Link href="/">
                        <Button variant="outline">Return Home</Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
