import { Link, useLocation } from "react-router";
import { ArrowLeft, Book, GraduationCap, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import { updateMetaTags, resetMetaTags } from "../utils/seo";

export function SitemapIndexPage() {
    const location = useLocation();
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const isStories = location.pathname.includes("all-stories");

    useEffect(() => {
        const fetchAll = async () => {
            setIsLoading(true);
            try {
                const type = isStories ? 'story' : 'lesson';
                const data = await api.creations.getPublic({ limit: 1000, type });
                setItems(data);
            } catch (error) {
                console.error("Failed to fetch all items:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAll();
    }, [isStories]);

    const title = isStories ? "All Fairy Tales & Adventures" : "All Educational Lessons";
    const type = isStories ? "story" : "lesson";

    // Alphabetical grouping
    const groupedItems: Record<string, any[]> = {};
    [...items]
        .sort((a, b) => {
            const titleA = (a.englishTitle || a.title || a.topic || "").toLowerCase();
            const titleB = (b.englishTitle || b.title || b.topic || "").toLowerCase();
            return titleA.localeCompare(titleB);
        })
        .forEach(item => {
            const displayTitle = item.englishTitle || item.title || item.topic || "#";
            const firstChar = displayTitle[0].toUpperCase();
            const key = /[A-Z]/.test(firstChar) ? firstChar : "#";
            if (!groupedItems[key]) groupedItems[key] = [];
            groupedItems[key].push(item);
        });

    const sortedKeys = Object.keys(groupedItems).sort((a, b) => {
        if (a === "#") return 1;
        if (b === "#") return -1;
        return a.localeCompare(b);
    });

    useEffect(() => {
        updateMetaTags(
            title,
            `Complete alphabetical index of ${isStories ? "personalized stories" : "educational lessons"} for children on QuickStory.AI.`,
            [isStories ? "stories index" : "lessons index", "alphabetical", "sitemap"],
            "library"
        );
        return () => resetMetaTags();
    }, [title, isStories]);

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4">
            <div className="max-w-5xl mx-auto">
                <Link to="/sitemap">
                    <Button variant="ghost" className="mb-8 -ml-2 text-slate-600">
                        <ArrowLeft className="size-4 mr-2" />
                        Back to Sitemap
                    </Button>
                </Link>

                <div className="flex items-center gap-4 mb-12">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 text-indigo-600">
                        {isStories ? <Book className="size-8" /> : <GraduationCap className="size-8" />}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
                        <p className="text-slate-500 mt-1">Browse our complete collection alphabetically</p>
                    </div>
                </div>

                {/* Index Navigation */}
                <div className="flex flex-wrap gap-2 mb-12 sticky top-20 z-20 bg-slate-50/80 backdrop-blur-sm py-4">
                    {sortedKeys.map(key => (
                        <a
                            key={key}
                            href={`#section-${key}`}
                            className="size-10 flex items-center justify-center bg-white rounded-lg border border-slate-200 text-slate-600 font-bold hover:border-indigo-400 hover:text-indigo-600 transition-colors shadow-sm"
                        >
                            {key}
                        </a>
                    ))}
                </div>

                <div className="space-y-12">
                    {sortedKeys.map(key => (
                        <section key={key} id={`section-${key}`} className="scroll-mt-40">
                            <div className="flex items-center gap-4 mb-6">
                                <h2 className="text-4xl font-extrabold text-slate-200 select-none">{key}</h2>
                                <div className="h-px bg-slate-200 flex-1" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {groupedItems[key].map(item => (
                                    <Link
                                        key={item.id}
                                        to={`/${type}/${item.slug || item.id}`}
                                        title={`Read the ${type}: ${item.englishTitle || item.title || item.topic}`}
                                        className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group"
                                    >
                                        <div className="flex items-start justify-between">
                                            <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                                {item.englishTitle || item.title || item.topic}
                                            </span>
                                            <Sparkles className="size-4 text-slate-300 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
                                        </div>
                                        <div className="mt-2 flex gap-2">
                                            {item.tags?.slice(0, 3).map((tag: any) => {
                                                const tagName = typeof tag === 'string' ? tag : tag.name;
                                                return <span key={tagName} className="text-xs text-slate-400">#{tagName}</span>;
                                            })}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                {isLoading ? (
                    <div className="text-center py-24 bg-white rounded-3xl border border-slate-200">
                        <div className="animate-spin size-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-slate-400">Loading collection...</p>
                    </div>
                ) : items.length === 0 && (
                    <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400">No {isStories ? "stories" : "lessons"} found yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
