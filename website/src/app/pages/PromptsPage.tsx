import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Shield, BookOpen, Sparkles, FlaskConical, MessageSquareText, ImageIcon, Loader2 } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { setNoIndex } from "../utils/seo";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// ─────────────────────────────────────────────────────────────────────────────
// Types — matches PromptSectionDef from server/prompts.ts
// ─────────────────────────────────────────────────────────────────────────────

interface PromptDef {
    label: string;
    role: "system" | "user";
    content: string;
    note?: string;
}

interface PromptSectionDef {
    id: string;
    title: string;
    icon: string; // lucide icon name from server
    description: string;
    source: string;
    prompts: PromptDef[];
}

// Map server icon names to actual lucide-react components
const ICON_MAP: Record<string, React.ReactNode> = {
    Sparkles: <Sparkles className="size-5" />,
    BookOpen: <BookOpen className="size-5" />,
    FlaskConical: <FlaskConical className="size-5" />,
    ImageIcon: <ImageIcon className="size-5" />,
    MessageSquareText: <MessageSquareText className="size-5" />,
};

function getIcon(name: string): React.ReactNode {
    return ICON_MAP[name] || <Sparkles className="size-5" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PromptsPage() {
    const { user } = useApp();
    const navigate = useNavigate();
    const [sections, setSections] = useState<PromptSectionDef[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setNoIndex(true);
        if (user && !user.isAdmin) {
            navigate("/");
        }
        return () => setNoIndex(false);
    }, [user, navigate]);

    useEffect(() => {
        if (!user?.isAdmin) return;

        async function fetchSections() {
            try {
                setLoading(true);
                const res = await fetch(`${API_URL}/admin/prompt-sections`, { credentials: "include" });
                if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
                const data = await res.json();
                setSections(data);
            } catch (err) {
                console.error("[PromptsPage] Fetch error:", err);
                setError(err instanceof Error ? err.message : "Failed to load prompts");
            } finally {
                setLoading(false);
            }
        }

        fetchSections();
    }, [user]);

    if (!user || !user.isAdmin) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-24 text-center">
                <Shield className="size-16 text-gray-300 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-400">Unauthorized</h1>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-12">
            {/* Header */}
            <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-white shadow-xl">
                <h1 className="text-4xl font-bold mb-2">AI Prompts Reference</h1>
                <p className="text-violet-100 opacity-90">
                    All AI prompts used across story and lesson generation. Variables shown as <code className="bg-white/20 px-1.5 py-0.5 rounded text-sm">{"{variable}"}</code> are filled in at runtime.
                </p>
            </div>

            {/* Loading / Error states */}
            {loading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="size-8 text-indigo-500 animate-spin" />
                    <span className="ml-3 text-gray-500">Loading prompts from server...</span>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 text-red-700">
                    Failed to load prompts: {error}
                </div>
            )}

            {!loading && !error && sections.length > 0 && (
                <>
                    {/* Quick nav */}
                    <div className="bg-white rounded-xl border shadow-sm p-4 mb-8">
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Jump to</h2>
                        <div className="flex flex-wrap gap-2">
                            {sections.map((section) => (
                                <a
                                    key={section.id}
                                    href={`#${section.id}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-sm font-medium text-gray-700 transition-colors"
                                >
                                    {getIcon(section.icon)}
                                    {section.title}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Sections */}
                    <div className="space-y-8">
                        {sections.map((section) => (
                            <section
                                key={section.id}
                                id={section.id}
                                className="bg-white rounded-2xl border shadow-sm overflow-hidden scroll-mt-24"
                            >
                                {/* Section header */}
                                <div className="px-6 py-5 border-b bg-gray-50">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                                            {getIcon(section.icon)}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
                                            <p className="text-sm text-gray-500">{section.description}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <span className="inline-flex items-center text-xs font-mono bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                            {section.source}
                                        </span>
                                    </div>
                                </div>

                                {/* Prompts */}
                                <div className="divide-y">
                                    {section.prompts.map((prompt, i) => (
                                        <div key={i} className="px-6 py-5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span
                                                    className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${prompt.role === "system"
                                                        ? "bg-purple-100 text-purple-700"
                                                        : "bg-green-100 text-green-700"
                                                        }`}
                                                >
                                                    {prompt.role}
                                                </span>
                                                <span className="text-sm font-medium text-gray-700">{prompt.label}</span>
                                            </div>
                                            <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 border rounded-xl p-4 leading-relaxed overflow-x-auto font-mono">
                                                {prompt.content}
                                            </pre>
                                            {prompt.note && (
                                                <p className="mt-2 text-xs text-gray-500 italic">{prompt.note}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
