import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { ArrowLeft, GraduationCap, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { api } from "../services/api";
import { LessonCard } from "../components/LessonCard";
import { Lesson } from "../types";
import { updateMetaTags, resetMetaTags } from "../utils/seo";
import { debounce } from "lodash";
import { useLanguage } from "../contexts/LanguageContext";

/** Fetch all lessons in batches until no more results */
const BATCH_SIZE = 100;

/** Group lessons by their first letter for alphabetical navigation */
function groupByLetter(lessons: Lesson[]): Map<string, Lesson[]> {
    const groups = new Map<string, Lesson[]>();
    for (const lesson of lessons) {
        const title = lesson.topic || "";
        const letter = title.charAt(0).toUpperCase();
        const key = /[A-Za-z\u0590-\u05FF\u0600-\u06FF]/.test(letter) ? letter : "#";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(lesson);
    }
    return new Map([...groups.entries()].sort(([a], [b]) => {
        if (a === "#") return 1;
        if (b === "#") return -1;
        return a.localeCompare(b);
    }));
}

export function AllLessonsPage() {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const { lang, localizedPath, t } = useLanguage();

    /** Fetch ALL lessons by paginating through the API in batches */
    const fetchAllLessons = async (query: string) => {
        setIsLoading(true);
        try {
            const all: Lesson[] = [];
            let offset = 0;
            while (true) {
                const batch = await api.creations.getPublic({
                    type: 'lesson',
                    q: query,
                    limit: BATCH_SIZE,
                    offset,
                    sort: 'latest',
                    lang
                });
                all.push(...batch);
                if (batch.length < BATCH_SIZE) break;
                offset += BATCH_SIZE;
            }
            setLessons(all);
        } catch (error) {
            console.error("Failed to fetch lessons:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Debounced search
    const debouncedSearch = useCallback(
        debounce((query: string) => {
            fetchAllLessons(query);
        }, 500),
        [lang]
    );

    useEffect(() => {
        fetchAllLessons("");
        updateMetaTags(
            t("allLessons.seoTitle"),
            t("allLessons.seoDescription"),
            ["lessons", "educational lessons", "kids learning", "personalized education", "lesson directory", "A-Z lessons"],
            "library"
        );
        return () => resetMetaTags();
    }, [lang]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        debouncedSearch(query);
    };

    // Sort lessons alphabetically by topic
    const sortedLessons = useMemo(() => {
        return [...lessons].sort((a, b) => (a.topic || "").localeCompare(b.topic || "", lang));
    }, [lessons, lang]);

    // Group by first letter for alphabetical index
    const letterGroups = useMemo(() => groupByLetter(sortedLessons), [sortedLessons]);
    const letters = useMemo(() => Array.from(letterGroups.keys()), [letterGroups]);

    const isSearching = searchQuery.trim().length > 0;

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4">
            <div className="max-w-7xl mx-auto">
                <Link to={localizedPath("/sitemap")}>
                    <Button variant="ghost" className="mb-8 -ml-2 text-slate-600">
                        <ArrowLeft className="size-4 mr-2" />
                        {t("common.backToSitemap")}
                    </Button>
                </Link>

                {/* Semantic header with h1 for bots */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 text-blue-600">
                            <GraduationCap className="size-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">{t("allLessons.title")}</h1>
                            <p className="text-slate-500 mt-1">{t("allLessons.subtitle")}</p>
                        </div>
                    </div>

                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <Input
                            placeholder={t("allLessons.searchPlaceholder")}
                            value={searchQuery}
                            onChange={handleSearchChange}
                            className="pl-10 h-12 bg-white border-slate-200 focus:border-blue-400 focus:ring-blue-400 rounded-xl"
                        />
                    </div>
                </header>

                {/* Alphabetical quick-jump nav — visible to bots and users */}
                {!isSearching && letters.length > 1 && (
                    <nav aria-label={t("allLessons.alphabeticalNav")} className="mb-8 flex flex-wrap gap-2">
                        {letters.map(letter => (
                            <a
                                key={letter}
                                href={`#letter-${letter}`}
                                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 font-semibold text-sm transition-colors"
                            >
                                {letter}
                            </a>
                        ))}
                    </nav>
                )}

                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-[200px] bg-white rounded-2xl border border-slate-100 animate-pulse" />
                        ))}
                    </div>
                ) : sortedLessons.length > 0 ? (
                    <>
                        {/* Alphabetical sections when not searching */}
                        {!isSearching ? (
                            Array.from(letterGroups.entries()).map(([letter, group]) => (
                                <section key={letter} id={`letter-${letter}`} className="mb-10">
                                    <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">
                                        {letter}
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {group.map((lesson) => (
                                            <LessonCard key={lesson.id} lesson={lesson} hideImage />
                                        ))}
                                    </div>
                                </section>
                            ))
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {sortedLessons.map((lesson) => (
                                    <LessonCard key={lesson.id} lesson={lesson} hideImage />
                                ))}
                            </div>
                        )}

                        {/* Hidden semantic link list for bots (noscript fallback) */}
                        <noscript>
                            <nav aria-label="All Lessons Directory">
                                <ul>
                                    {sortedLessons.map((lesson) => (
                                        <li key={lesson.id}>
                                            <a href={localizedPath(`/lesson/${lesson.slug || lesson.id}`)}>
                                                {lesson.topic}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </nav>
                        </noscript>
                    </>
                ) : (
                    <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <Search className="size-16 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-700">{t("allLessons.noResults")}</h3>
                        <p className="text-slate-500 mt-2">{t("allLessons.noResultsDesc")}</p>
                        <Button
                            variant="link"
                            onClick={() => { setSearchQuery(""); fetchAllLessons(""); }}
                            className="mt-4 text-blue-600"
                        >
                            {t("common.clearSearch")}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
