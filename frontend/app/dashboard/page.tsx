"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, HardDrive, FileText, UploadCloud, PieChart as PieIcon } from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";

import { useFileStats } from "@/lib/hooks/use-files";
import type { FileStatus } from "@/lib/api/files";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function formatBytes(bytes: number) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const STATUS_LABELS: Record<FileStatus, string> = {
    pending: "Pending",
    processing: "Processing",
    ready: "Ready",
    failed: "Failed",
};

export default function DashboardPage() {
    // Backed by api-svc's GET /files/stats, which aggregates across the whole
    // account (every folder), not just the root level.
    const { data: rawStats, isLoading } = useFileStats();

    const stats = useMemo(() => {
        const statusCounts = rawStats?.status_counts ?? {};
        const typeCounts = rawStats?.type_counts ?? {};

        return {
            totalFiles: rawStats?.total_files ?? 0,
            totalBytes: rawStats?.total_bytes ?? 0,
            statusData: Object.entries(statusCounts).map(([status, count]) => ({
                name: STATUS_LABELS[status as FileStatus] ?? status,
                count,
            })),
            typeData: Object.entries(typeCounts).map(([name, value]) => ({ name, value })),
        };
    }, [rawStats]);

    if (isLoading) {
        return (
            <div className="w-full h-[60vh] flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p>Loading your files...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">Dashboard Overview</h1>
                    <p className="text-muted-foreground text-lg">Every file across your account, in every folder.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-border/50 bg-card/60 overflow-hidden relative">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Storage Used</CardTitle>
                        <HardDrive className="h-5 w-5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatBytes(stats.totalBytes)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Quota isn&apos;t enforced yet</p>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/60 overflow-hidden relative">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -mr-10 -mt-10" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Files</CardTitle>
                        <FileText className="h-5 w-5 text-accent" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.totalFiles}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across your whole account</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="lg:col-span-4 border-border/50 bg-card/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UploadCloud size={20} className="text-primary" />
                            Processing Status
                        </CardTitle>
                        <CardDescription>Where your files currently stand in the pipeline.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {stats.statusData.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                                <UploadCloud size={40} className="opacity-20 mb-2" />
                                No files uploaded yet.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.statusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} stroke="var(--muted-foreground)" />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px" }}
                                        itemStyle={{ color: "var(--foreground)" }}
                                    />
                                    <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]} animationDuration={800} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3 border-border/50 bg-card/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieIcon size={20} className="text-accent" />
                            File Distribution
                        </CardTitle>
                        <CardDescription>A breakdown of the types of files you store.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        {stats.typeData.length === 0 ? (
                            <div className="text-muted-foreground text-sm flex flex-col items-center">
                                <PieIcon size={40} className="opacity-20 mb-2" />
                                No files uploaded yet.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px" }}
                                        itemStyle={{ color: "var(--foreground)" }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                    <Pie
                                        data={stats.typeData}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        animationDuration={800}
                                    >
                                        {stats.typeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
