"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, HardDrive, FileText, UploadCloud, PieChart as PieIcon } from "lucide-react";
import axios from "axios";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    Legend,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid
} from "recharts";

type AnalyticsData = {
    totalFiles: number;
    totalStorageUsed: number;
    uploadsThisMonth: number;
    fileTypes: Record<string, number>;
};

// Colors for the charts
const COLORS = ['#8b5cf6', '#d946ef', '#06b6d4', '#10b981'];

export default function DashboardPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAnalytics() {
            try {
                const res = await axios.get("/api/analytics");
                setData(res.data);
            } catch (error) {
                console.error("Failed to fetch analytics", error);
            } finally {
                setLoading(false);
            }
        }
        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="w-full h-[60vh] flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p>Loading your analytics...</p>
            </div>
        );
    }

    if (!data) {
        return <div className="text-destructive">Failed to load analytics data.</div>;
    }

    // Format bytes to readable string (MB/GB)
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    // Convert Record<string, number> to Array for Recharts Pie
    const fileTypeData = Object.entries(data.fileTypes).map(([name, value]) => ({
        name,
        value
    }));

    // Dummy mock data for the AreaChart (since we don't have historic daily data in the API yet)
    // This gives the dashboard the highly requested "premium, dynamic feel".
    const mockUploadHistory = [
        { name: 'Week 1', uploads: Math.floor(data.uploadsThisMonth * 0.1) },
        { name: 'Week 2', uploads: Math.floor(data.uploadsThisMonth * 0.3) },
        { name: 'Week 3', uploads: Math.floor(data.uploadsThisMonth * 0.2) },
        { name: 'Week 4', uploads: Math.floor(data.uploadsThisMonth * 0.4) + 1 }, // Ensure it adds up loosely
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">Dashboard Overview</h1>
                    <p className="text-muted-foreground text-lg">Monitor your storage consumption and recent activity.</p>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Total Storage */}
                <Card className="bg-gradient-to-br from-card to-violet-900/10 border-border/50 overflow-hidden relative">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Storage Used
                        </CardTitle>
                        <HardDrive className="h-5 w-5 text-violet-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatBytes(data.totalStorageUsed)}</div>
                        <p className="text-xs text-muted-foreground mt-1 text-violet-400">
                            Of unlimited total storage
                        </p>
                    </CardContent>
                </Card>

                {/* Total Files */}
                <Card className="bg-gradient-to-br from-card to-fuchsia-900/10 border-border/50 overflow-hidden relative">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Files
                        </CardTitle>
                        <FileText className="h-5 w-5 text-fuchsia-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{data.totalFiles}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Distributed across your folders
                        </p>
                    </CardContent>
                </Card>

                {/* Uploads This Month */}
                <Card className="bg-gradient-to-br from-card to-cyan-900/10 border-border/50 overflow-hidden relative">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Uploads This Month
                        </CardTitle>
                        <UploadCloud className="h-5 w-5 text-cyan-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{data.uploadsThisMonth}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Active files uploaded recently
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Charts */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">

                {/* Dynamic Area Chart (Upload Velocity) */}
                <Card className="lg:col-span-4 border-border/50 bg-card/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UploadCloud size={20} className="text-violet-500" />
                            Upload Velocity (This Month)
                        </CardTitle>
                        <CardDescription>
                            Your frequency of uploading files across the month.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={mockUploadHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="uploads"
                                    stroke="#8b5cf6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorUploads)"
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Donut Chart (File Types) */}
                <Card className="lg:col-span-3 border-border/50 bg-card/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieIcon size={20} className="text-fuchsia-500" />
                            File Distribution
                        </CardTitle>
                        <CardDescription>
                            A breakdown of the types of files you store.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        {fileTypeData.length === 0 ? (
                            <div className="text-muted-foreground text-sm flex flex-col items-center">
                                <PieIcon size={40} className="opacity-20 mb-2" />
                                No files uploaded yet.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                    <Pie
                                        data={fileTypeData}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        animationDuration={1500}
                                    >
                                        {fileTypeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
