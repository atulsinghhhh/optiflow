"use client";

import React, { useState, useRef, useCallback } from "react";
import { 
    UploadCloud, 
    File, 
    X, 
    CheckCircle2, 
    AlertCircle, 
    RefreshCcw,
    FileText,
    ImageIcon,
    Video,
    Music,
    Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type UploadStatus = "uploading" | "completed" | "error";

interface UploadFile {
    id: string;
    file: File;
    progress: number;
    status: UploadStatus;
    speed: string;
    error?: string;
}

export function FileUpload() {
    const [isDragging, setIsDragging] = useState(false);
    const [uploads, setUploads] = useState<UploadFile[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback((files: FileList | File[]) => {
        const newUploads = Array.from(files).map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            progress: 0,
            status: "uploading" as const,
            speed: "0 MB/s",
        }));

        setUploads(prev => [...newUploads, ...prev]);

        // Simulate upload progress for each file
        newUploads.forEach(upload => simulateUpload(upload.id));
    }, []);

    const simulateUpload = (id: string) => {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setUploads(prev => prev.map(u => 
                    u.id === id ? { ...u, progress: 100, status: "completed", speed: "0 MB/s" } : u
                ));
            } else {
                // Random failure simulation (5% chance)
                if (progress > 50 && Math.random() < 0.02) {
                    clearInterval(interval);
                    setUploads(prev => prev.map(u => 
                        u.id === id ? { ...u, status: "error", error: "Connection interrupted" } : u
                    ));
                } else {
                    setUploads(prev => prev.map(u => 
                        u.id === id ? { ...u, progress, speed: (Math.random() * 5 + 1).toFixed(1) + " MB/s" } : u
                    ));
                }
            }
        }, 500);
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => {
        setIsDragging(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const removeUpload = (id: string) => {
        setUploads(prev => prev.filter(u => u.id !== id));
    };

    const retryUpload = (id: string) => {
        setUploads(prev => prev.map(u => 
            u.id === id ? { ...u, status: "uploading", progress: 0, error: undefined } : u
        ));
        simulateUpload(id);
    };

    const getFileIcon = (mime: string) => {
        if (mime.startsWith("image/")) return <ImageIcon className="text-pink-400" size={20} />;
        if (mime.startsWith("video/")) return <Video className="text-orange-400" size={20} />;
        if (mime.startsWith("audio/")) return <Music className="text-cyan-400" size={20} />;
        return <FileText className="text-violet-400" size={20} />;
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* Drag and Drop Zone */}
            <motion.div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                    "relative group cursor-pointer overflow-hidden rounded-[32px] border-2 border-dashed transition-all duration-500",
                    isDragging 
                        ? "border-violet-500 bg-violet-500/10 shadow-[0_0_40px_rgba(124,58,237,0.2)]" 
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-800/50"
                )}
            >
                {/* Animated Border Gradient */}
                <div className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                    "bg-[linear-gradient(45deg,transparent_25%,rgba(124,58,237,0.1)_50%,transparent_75%)] bg-[length:250%_250%] animate-[gradient_3s_linear_infinite]"
                )} />

                <div className="relative p-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className={cn(
                        "p-6 rounded-3xl bg-slate-900 border border-slate-800 transition-all duration-500",
                        "group-hover:scale-110 group-hover:border-violet-500/50 group-hover:shadow-[0_0_30px_rgba(124,58,237,0.3)]",
                        isDragging && "scale-110 border-violet-500 shadow-[0_0_30px_rgba(124,58,237,0.5)]"
                    )}>
                        <UploadCloud size={48} className={cn(
                            "transition-colors duration-500",
                            isDragging ? "text-violet-400" : "text-slate-500 group-hover:text-violet-400"
                        )} />
                    </div>
                    
                    <div className="space-y-1">
                        <p className="text-xl font-bold text-white tracking-tight">
                            {isDragging ? "Drop your files here" : "Drag & drop files to upload"}
                        </p>
                        <p className="text-slate-400 text-sm">
                            Support for images, videos, and documents up to 500MB
                        </p>
                    </div>

                    <Button 
                        variant="outline" 
                        className="bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white rounded-xl px-8 h-12"
                    >
                        Browse Files
                    </Button>
                </div>

                <input 
                    type="file" 
                    multiple 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
            </motion.div>

            {/* Upload List */}
            <div className="space-y-3">
                <AnimatePresence initial={false}>
                    {uploads.map((upload) => (
                        <motion.div
                            key={upload.id}
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="p-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-2xl group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                                    {getFileIcon(upload.file.type)}
                                </div>

                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold text-white truncate pr-4">
                                            {upload.file.name}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            {upload.status === "completed" && (
                                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                                    Success
                                                </span>
                                            )}
                                            {upload.status === "error" && (
                                                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider bg-rose-400/10 px-2 py-0.5 rounded-full">
                                                    Failed
                                                </span>
                                            )}
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                {formatSize(upload.file.size)}
                                            </span>
                                        </div>
                                    </div>

                                    {upload.status === "uploading" && (
                                        <div className="space-y-2">
                                            <Progress value={upload.progress} className="h-1.5 bg-slate-800" />
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] text-slate-500 font-medium">
                                                    {Math.round(upload.progress)}% • {upload.speed}
                                                </p>
                                                <button 
                                                    onClick={() => removeUpload(upload.id)}
                                                    className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {upload.status === "completed" && (
                                        <div className="flex items-center justify-between pt-1">
                                            <div className="flex items-center gap-2 text-emerald-400">
                                                <CheckCircle2 size={14} />
                                                <span className="text-[10px] font-semibold">Ready to share</span>
                                            </div>
                                            <button 
                                                onClick={() => removeUpload(upload.id)}
                                                className="text-slate-500 hover:text-white transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}

                                    {upload.status === "error" && (
                                        <div className="flex items-center justify-between pt-1">
                                            <div className="flex items-center gap-2 text-rose-400">
                                                <AlertCircle size={14} />
                                                <span className="text-[10px] font-semibold">{upload.error}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => retryUpload(upload.id)}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-violet-400 hover:text-violet-300 uppercase tracking-wider"
                                                >
                                                    <RefreshCcw size={10} />
                                                    Retry
                                                </button>
                                                <button 
                                                    onClick={() => removeUpload(upload.id)}
                                                    className="text-slate-500 hover:text-white transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <style jsx global>{`
                @keyframes gradient {
                    0% { background-position: 0% 0%; }
                    100% { background-position: 100% 100%; }
                }
            `}</style>
        </div>
    );
}
