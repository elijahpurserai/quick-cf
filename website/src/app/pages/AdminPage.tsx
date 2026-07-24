import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Shield, BookOpen, GraduationCap, Users, Ghost, Loader2 } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { setNoIndex } from "../utils/seo";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

interface UserStat {
    id: string;
    email: string;
    name: string;
    avatar: string;
    storyCount: number;
    lessonCount: number;
    latestStoryAt: string | null;
}

interface AnalyticsData {
    totals: { stories: number; lessons: number; users: number };
    users: UserStat[];
    anonymous: { storyCount: number; lessonCount: number; latestStoryAt: string | null };
}

function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function AdminPage() {
    const { user } = useApp();
    const navigate = useNavigate();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Block non-approved users
    useEffect(() => {
        if (user && !user.isAdmin) {
            navigate("/");
        }
    }, [user, navigate]);

    // noindex
    useEffect(() => {
        setNoIndex(true);
        return () => setNoIndex(false);
    }, []);

    // Fetch analytics
    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await fetch(`${API_URL}/admin/analytics`, { credentials: "include" });
                if (!res.ok) {
                    if (res.status === 403) { navigate("/"); return; }
                    throw new Error("Failed to fetch analytics");
                }
                const json = await res.json();
                setData(json);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, [navigate]);

    if (!user || !user.isAdmin) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-24 text-center">
                <Shield className="size-16 text-gray-300 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-700">Access Restricted</h1>
                <p className="text-gray-500 mt-2">This page is only available to approved users.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Header */}
            <div className="mb-10">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Analytics Dashboard
                </h1>
                <p className="text-gray-500 mt-1">Overview of all stories, lessons, and users.</p>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
            )}

            {/* Loading state */}
            {loading && (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="size-8 text-indigo-500 animate-spin" />
                </div>
            )}

            {data && (
                <>
                    {/* Summary Tiles */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
                        <Tile
                            icon={<BookOpen className="size-7" />}
                            label="Total Stories"
                            value={data.totals.stories}
                            gradient="from-blue-500 to-cyan-400"
                        />
                        <Tile
                            icon={<GraduationCap className="size-7" />}
                            label="Total Lessons"
                            value={data.totals.lessons}
                            gradient="from-emerald-500 to-teal-400"
                        />
                        <Tile
                            icon={<Users className="size-7" />}
                            label="Total Users"
                            value={data.totals.users}
                            gradient="from-violet-500 to-purple-400"
                        />
                    </div>

                    {/* User Table */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8 shadow-sm">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">Users</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wider">
                                        <th className="px-5 py-3">User</th>
                                        <th className="px-5 py-3 text-center">Stories</th>
                                        <th className="px-5 py-3 text-center">Lessons</th>
                                        <th className="px-5 py-3">Latest Story</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {data.users.map((u) => (
                                        <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    {u.avatar ? (
                                                        <img
                                                            src={u.avatar}
                                                            alt={u.name}
                                                            className="size-8 rounded-full object-cover ring-2 ring-gray-100"
                                                        />
                                                    ) : (
                                                        <div className="size-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">
                                                            {(u.name || u.email || "?")[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-gray-900">{u.name || "—"}</p>
                                                        <p className="text-xs text-gray-400">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className="inline-flex items-center justify-center min-w-[2rem] rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-semibold">
                                                    {u.storyCount}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className="inline-flex items-center justify-center min-w-[2rem] rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-semibold">
                                                    {u.lessonCount}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-500 text-xs">
                                                {formatDate(u.latestStoryAt)}
                                            </td>
                                        </tr>
                                    ))}
                                    {data.users.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-5 py-8 text-center text-gray-400">No users found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Anonymous Section */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                            <Ghost className="size-5 text-gray-400" />
                            <h2 className="text-lg font-semibold text-gray-900">Anonymous</h2>
                        </div>
                        <div className="px-5 py-5">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-gray-800">{data.anonymous.storyCount}</p>
                                    <p className="text-xs text-gray-500 mt-1">Stories</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-gray-800">{data.anonymous.lessonCount}</p>
                                    <p className="text-xs text-gray-500 mt-1">Lessons</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 text-center">
                                    <p className="text-sm font-medium text-gray-800">{formatDate(data.anonymous.latestStoryAt)}</p>
                                    <p className="text-xs text-gray-500 mt-1">Latest Story</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/* ─── Tile component ─────────────────────────────────────────────────── */

function Tile({ icon, label, value, gradient }: { icon: React.ReactNode; label: string; value: number; gradient: string }) {
    return (
        <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg`}>
            <div className="absolute -right-3 -top-3 opacity-20">
                {icon && <div className="scale-[3]">{icon}</div>}
            </div>
            <p className="text-sm font-medium opacity-90">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
    );
}
