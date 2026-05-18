"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { User, Mail, HardDrive, Shield, Edit2, Check, X, Camera, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserProfile = {
    id: string;
    name: string | null;
    username: string | null;
    email: string;
    bio: string | null;
    avatar_url: string | null;
    created_at: string;
};

type StorageStats = {
    storageUsed: number;
    storageLimit: number;
    fileCount: number;
};

export default function ProfilePage() {
    const { data: session, update: updateSession } = useSession();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [bio, setBio] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [saving, setSaving] = useState(false);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const res = await axios.get("/api/profile");
            setProfile(res.data.user);
            setStats(res.data.stats);

            setName(res.data.user.name || "");
            setUsername(res.data.user.username || "");
            setBio(res.data.user.bio || "");
            setAvatarUrl(res.data.user.avatar_url || res.data.user.image || "");
        } catch (error) {
            toast.error("Failed to load profile data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await axios.patch("/api/profile", {
                name: name.trim() || null,
                username: username.trim() || null,
                bio: bio.trim() || null,
                avatar_url: avatarUrl.trim() || null,
            });

            setProfile(res.data.user);
            setIsEditing(false);
            toast.success("Profile updated successfully!");
            // Trigger real-time session update
            await updateSession();
            window.dispatchEvent(new Event("profile_updated"));
        } catch (error) {
            toast.error("Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    if (loading) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <div className="h-12 w-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!profile || !stats) return null;

    const storagePercentage = Math.min(Math.round((stats.storageUsed / stats.storageLimit) * 100), 100);

    return (
        <div className="max-w-4xl mx-auto space-y-10">
            {/* Header Banner */}
            <div className="relative rounded-3xl overflow-hidden bg-linear-to-r from-violet-600 to-fuchsia-600 p-8 shadow-2xl md:p-12">
                <div className="absolute inset-0 bg-black/20 backdrop-blur-xs" />
                <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                    <div className="relative group">
                        <Avatar className="w-32 h-32 border-4 border-white/20 shadow-2xl">
                            <AvatarImage src={avatarUrl || session?.user?.image || ""} />
                            <AvatarFallback className="bg-slate-900 text-violet-400 text-4xl font-bold">
                                {profile.name?.[0] || "U"}
                            </AvatarFallback>
                        </Avatar>
                        {isEditing && (
                            <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white font-medium text-xs cursor-pointer hover:bg-black/80 transition-colors backdrop-blur-xs">
                                <Camera size={20} />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 flex-1">
                        <div className="flex flex-col md:flex-row items-center gap-3">
                            <h1 className="text-4xl font-extrabold text-white tracking-tight">{profile.name || "Unnamed User"}</h1>
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase text-white tracking-wider flex items-center gap-1 shadow-inner">
                                <Shield size={12} /> PRO MEMBER
                            </span>
                        </div>
                        <p className="text-white/80 font-medium">{profile.email}</p>
                        {profile.username && (
                            <p className="text-violet-200 text-sm font-mono">@{profile.username}</p>
                        )}
                        <p className="text-white/60 text-xs italic">
                            Member since {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
                        </p>
                    </div>

                    <div>
                        {!isEditing ? (
                            <Button
                                onClick={() => setIsEditing(true)}
                                className="bg-white text-violet-900 hover:bg-white/90 px-6 py-6 rounded-2xl font-bold shadow-lg gap-2"
                            >
                                <Edit2 size={16} /> Edit Profile
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-6 rounded-2xl font-bold shadow-lg gap-2"
                                >
                                    <Check size={16} /> Save
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsEditing(false)}
                                    className="text-white hover:bg-white/10 px-4 py-6 rounded-2xl font-bold"
                                >
                                    <X size={16} />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Profile Form / Info */}
                <div className="md:col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-xl shadow-xl shadow-black/10">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <User size={20} className="text-violet-400" /> Profile Information
                    </h3>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Display Name</label>
                            {isEditing ? (
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="bg-slate-900/50 border-slate-700 text-white h-12 rounded-xl focus:ring-violet-500"
                                />
                            ) : (
                                <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800 text-white font-medium">
                                    {profile.name || "Not set"}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Username</label>
                            {isEditing ? (
                                <Input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="your_username"
                                    className="bg-slate-900/50 border-slate-700 text-white h-12 rounded-xl focus:ring-violet-500 font-mono"
                                />
                            ) : (
                                <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800 text-white font-mono">
                                    {profile.username ? `@${profile.username}` : "Not set"}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Avatar URL</label>
                            {isEditing ? (
                                <Input
                                    value={avatarUrl}
                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                    placeholder="https://example.com/avatar.jpg"
                                    className="bg-slate-900/50 border-slate-700 text-white h-12 rounded-xl focus:ring-violet-500"
                                />
                            ) : (
                                <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800 text-white text-sm truncate text-slate-400">
                                    {profile.avatar_url || "Using default/provider image"}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Bio</label>
                            {isEditing ? (
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    placeholder="Tell us a little about yourself..."
                                    rows={4}
                                    className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-all"
                                />
                            ) : (
                                <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800 text-white text-sm leading-relaxed italic">
                                    {profile.bio || "No bio added yet."}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Storage Status & Quota */}
                <div className="space-y-8">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-xl shadow-xl relative overflow-hidden">
                        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-violet-500/10 rounded-full blur-xl" />
                        
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <HardDrive size={20} className="text-violet-400" /> Storage Usage
                        </h3>

                        <div className="space-y-6">
                            <div className="flex items-end justify-between font-bold">
                                <span className="text-3xl text-white">{formatBytes(stats.storageUsed)}</span>
                                <span className="text-slate-400 text-sm">of {formatBytes(stats.storageLimit)}</span>
                            </div>

                            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${storagePercentage}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full shadow-lg shadow-violet-500/50"
                                />
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-400 font-medium pt-2 border-t border-slate-800/80">
                                <span>{stats.fileCount} Total Files</span>
                                <span>{storagePercentage}% Used</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-linear-to-br from-slate-900 to-slate-800 border border-slate-700/40 rounded-3xl p-8 text-center shadow-xl space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mx-auto shadow-inner">
                            <Sparkles size={24} />
                        </div>
                        <h4 className="text-lg font-bold text-white">Unlock Unlimited Storage</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Need more space for your team? Upgrade to Enterprise for unlimited bandwidth, priority queuing, and custom retention rules.
                        </p>
                        <Button className="w-full bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white py-6 rounded-2xl font-bold shadow-lg shadow-violet-500/20">
                            Upgrade Plan
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
