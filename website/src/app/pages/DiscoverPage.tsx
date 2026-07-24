import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Link } from "react-router";
import { Sparkles, BookOpen, Star, Filter } from "lucide-react";
import { api } from "../services/api";
import { Story, Lesson } from "../types";
import { updateMetaTags, resetMetaTags } from "../utils/seo";
import { SITE_NAME } from "../config";
import { useLanguage } from "../contexts/LanguageContext";

type ContentItem = {
    id: string;
    type: "story" | "lesson";
    title: string;
    imageUrl: string;
    slug: string;
    rating: number;
    description?: string;
};

type FilterType = "all" | "stories" | "lessons";

// ---------- helpers ----------
function randomBetween(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

const GLOW_COLORS = [
    "rgba(147, 51, 234, 0.35)",
    "rgba(236, 72, 153, 0.35)",
    "rgba(249, 115, 22, 0.35)",
    "rgba(59, 130, 246, 0.35)",
    "rgba(20, 184, 166, 0.35)",
    "rgba(234, 179, 8, 0.30)",
];

// Pre-generate stable random positions for the intro phase (up to 30 items).
// Images orbit in the OUTER ring so the center remains clear for the title text.
const introPositions = Array.from({ length: 40 }, (_, i) => {
    const angle = (i / 40) * Math.PI * 2;
    // Orbit in the outer ring, keeping center clear for title text
    const radius = randomBetween(28, 42);
    const startEdge = Math.floor(Math.random() * 4);
    const starts = [
        { x: randomBetween(20, 80), y: -20 },
        { x: 120, y: randomBetween(20, 80) },
        { x: randomBetween(20, 80), y: 120 },
        { x: -20, y: randomBetween(20, 80) },
    ];
    return {
        startX: starts[startEdge].x,
        startY: starts[startEdge].y,
        finalX: 50 + Math.cos(angle) * radius,
        finalY: 50 + Math.sin(angle) * radius,
        rotation: randomBetween(-18, 18),
        size: randomBetween(110, 190),
        floatDuration: randomBetween(3, 5),
        floatDelay: randomBetween(0, 2),
    };
});

// Pre-generate sparkle positions
const sparkleData = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: randomBetween(0, 100),
    y: randomBetween(0, 100),
    size: randomBetween(8, 20),
    delay: randomBetween(0, 3),
    duration: randomBetween(3, 7),
}));

// Pre-generate orb data
const orbData = GLOW_COLORS.map((color, i) => ({
    color,
    x: randomBetween(10, 90),
    y: randomBetween(10, 90),
    size: randomBetween(200, 450),
    delay: i * 0.6,
    duration: randomBetween(5, 9),
}));

// ---------- sub-components ----------

function IntroSparkles() {
    return (
        <>
            {sparkleData.map((p) => (
                <motion.div
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{
                        opacity: [0, 0.9, 0],
                        scale: [0.4, 1.3, 0.4],
                        x: [0, (Math.random() - 0.5) * 120],
                        y: [0, (Math.random() - 0.5) * 120],
                    }}
                    transition={{ duration: p.duration, repeat: Infinity, delay: p.delay }}
                    className="absolute pointer-events-none"
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                >
                    <Sparkles
                        style={{ width: p.size, height: p.size }}
                        className="text-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,0.9)]"
                    />
                </motion.div>
            ))}
        </>
    );
}

function GlowOrbs() {
    return (
        <>
            {orbData.map((orb, i) => (
                <motion.div
                    key={i}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: orb.duration, repeat: Infinity, delay: orb.delay }}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        left: `${orb.x}%`,
                        top: `${orb.y}%`,
                        width: orb.size,
                        height: orb.size,
                        background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
                        transform: "translate(-50%, -50%)",
                        filter: "blur(60px)",
                    }}
                />
            ))}
        </>
    );
}

// ==========================================================================
// MAIN PAGE COMPONENT
// ==========================================================================

export function DiscoverPage() {
    const [items, setItems] = useState<ContentItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [phase, setPhase] = useState<"intro" | "gallery">("intro");
    const [filter, setFilter] = useState<FilterType>("all");
    const [visibleCount, setVisibleCount] = useState(12);
    const { lang, localizedPath, t } = useLanguage();

    // SEO
    useEffect(() => {
        updateMetaTags(
            `Discover — ${SITE_NAME}`,
            "Explore a spectacular collection of stories and lessons. Dive in and find your next adventure!",
            ["discover", "stories", "lessons", "kids", "education"]
        );
        return () => resetMetaTags();
    }, []);

    // Fetch content
    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [stories, lessons] = await Promise.all([
                    api.creations.getPublic({ limit: 30, sort: "rating", type: "story", lang }),
                    api.creations.getPublic({ limit: 30, sort: "rating", type: "lesson", lang }),
                ]);

                const mapped: ContentItem[] = [
                    ...(stories as Story[])
                        .filter((s) => s.imageUrl)
                        .map((s) => ({
                            id: s.id,
                            type: "story" as const,
                            title: s.title,
                            imageUrl: s.imageUrl!,
                            slug: s.slug || s.id,
                            rating: s.rating,
                            description: s.description,
                        })),
                    ...(lessons as Lesson[])
                        .filter((l) => l.imageUrl)
                        .map((l) => ({
                            id: l.id,
                            type: "lesson" as const,
                            title: l.topic,
                            imageUrl: l.imageUrl!,
                            slug: l.slug || l.id,
                            rating: l.rating,
                            description: l.description,
                        })),
                ];

                // Shuffle
                for (let i = mapped.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [mapped[i], mapped[j]] = [mapped[j], mapped[i]];
                }

                setItems(mapped);
            } catch (err) {
                console.error("Failed to fetch discover items:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAll();
    }, [lang]);

    // Transition from intro → gallery after a delay
    useEffect(() => {
        if (items.length === 0) return;
        const timer = setTimeout(() => setPhase("gallery"), 4500);
        return () => clearTimeout(timer);
    }, [items]);

    const filteredItems = useMemo(() => {
        if (filter === "all") return items;
        return items.filter((i) =>
            filter === "stories" ? i.type === "story" : i.type === "lesson"
        );
    }, [items, filter]);

    const visibleItems = useMemo(
        () => filteredItems.slice(0, visibleCount),
        [filteredItems, visibleCount]
    );

    const handleLoadMore = useCallback(() => {
        setVisibleCount((c) => c + 12);
    }, []);

    // ---- Loading ----
    if (isLoading) {
        return (
            <div
                className="min-h-screen flex flex-col items-center justify-center"
                style={{
                    background: "linear-gradient(135deg, #0a0118 0%, #1a0533 40%, #0d0224 100%)",
                }}
            >
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                    <Sparkles className="size-16 text-purple-400" />
                </motion.div>
                <p className="text-purple-300 text-xl mt-4 font-light">
                    {t("discover.loading")}
                </p>
            </div>
        );
    }

    const isIntro = phase === "intro";

    return (
        <div
            className="min-h-screen relative overflow-hidden"
            style={{
                background: "linear-gradient(135deg, #0a0118 0%, #1a0533 40%, #0d0224 100%)",
            }}
        >
            {/* CSS for gradient shift animation */}
            <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

            {/* ============ Background ambiance (always visible) ============ */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0.15, 0.08] }}
                    transition={{ duration: 10, repeat: Infinity }}
                    className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full"
                    style={{
                        background: "radial-gradient(circle, rgba(147,51,234,0.3), transparent 70%)",
                        filter: "blur(80px)",
                    }}
                />
                <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.06, 0.12, 0.06] }}
                    transition={{ duration: 12, repeat: Infinity, delay: 2 }}
                    className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full"
                    style={{
                        background: "radial-gradient(circle, rgba(236,72,153,0.3), transparent 70%)",
                        filter: "blur(80px)",
                    }}
                />
                <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.05, 0.1, 0.05] }}
                    transition={{ duration: 8, repeat: Infinity, delay: 4 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
                    style={{
                        background: "radial-gradient(circle, rgba(59,130,246,0.25), transparent 70%)",
                        filter: "blur(80px)",
                    }}
                />
            </div>

            {/* ============ INTRO overlay elements (sparkles, orbs, title) ============ */}
            <AnimatePresence>
                {isIntro && (
                    <motion.div
                        key="intro-overlay"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className="fixed inset-0 z-30 pointer-events-none"
                    >
                        <GlowOrbs />
                        <IntroSparkles />

                        {/* Title that fades in during intro */}
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 2.2, duration: 1.2 }}
                            className="absolute inset-0 flex flex-col items-center justify-center z-40"
                        >
                            <div className="relative">
                                <div
                                    className="absolute inset-0 blur-3xl opacity-60"
                                    style={{
                                        background:
                                            "radial-gradient(ellipse, rgba(147,51,234,0.5) 0%, rgba(236,72,153,0.3) 40%, transparent 70%)",
                                    }}
                                />
                                <h1 className="relative text-5xl sm:text-7xl lg:text-8xl font-black text-center leading-tight">
                                    <span
                                        className="bg-clip-text text-transparent"
                                        style={{
                                            backgroundImage:
                                                "linear-gradient(135deg, #c084fc, #f472b6, #fb923c, #38bdf8)",
                                        }}
                                    >
                                        {t("discover.introTitle")}
                                    </span>
                                    <br />
                                    <span className="text-white/90 text-3xl sm:text-5xl lg:text-6xl font-light tracking-wide">
                                        {t("discover.introSubtitle")}
                                    </span>
                                </h1>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Skip button (during intro) */}
            {isIntro && (
                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    whileHover={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    onClick={() => setPhase("gallery")}
                    className="fixed bottom-8 right-8 z-50 text-white/60 text-sm border border-white/20 rounded-full px-4 py-2 backdrop-blur-md hover:bg-white/10 transition-colors"
                >
                    {t("discover.skipIntro")}
                </motion.button>
            )}

            {/* ============ UNIFIED IMAGE ELEMENTS — same items, different layout ============ */}
            <LayoutGroup>
                {/* During intro, the images are positioned absolutely in a full-screen container */}
                {isIntro && (
                    <div className="fixed inset-0 z-20 overflow-hidden">
                        {items.slice(0, 34).map((item, i) => {
                            const pos = introPositions[i];
                            return (
                                <motion.div
                                    key={item.id}
                                    layoutId={`card-${item.id}`}
                                    initial={{
                                        left: `${pos.startX}%`,
                                        top: `${pos.startY}%`,
                                        opacity: 0,
                                        scale: 0.3,
                                        rotate: pos.rotation - 40,
                                    }}
                                    animate={{
                                        left: `${pos.finalX}%`,
                                        top: `${pos.finalY}%`,
                                        opacity: 1,
                                        scale: 1,
                                        rotate: pos.rotation,
                                    }}
                                    transition={{
                                        delay: i * 0.08,
                                        duration: 1.2,
                                        type: "spring",
                                        stiffness: 50,
                                        damping: 12,
                                    }}
                                    className="absolute"
                                    style={{
                                        width: pos.size,
                                        height: pos.size,
                                        transform: "translate(-50%, -50%)",
                                        zIndex: 20 + i,
                                    }}
                                >
                                    <motion.div
                                        animate={{ y: [0, -8, 0] }}
                                        transition={{
                                            duration: pos.floatDuration,
                                            repeat: Infinity,
                                            ease: "easeInOut",
                                            delay: pos.floatDelay,
                                        }}
                                        className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30"
                                        style={{
                                            boxShadow: `0 0 30px ${GLOW_COLORS[i % GLOW_COLORS.length]}`,
                                        }}
                                    >
                                        <img
                                            src={item.imageUrl}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                            loading="eager"
                                        />
                                    </motion.div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* ============ GALLERY PHASE ============ */}
                {!isIntro && (
                    <div className="relative z-10">
                        {/* Header */}
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.1 }}
                            >
                                <h1 className="text-4xl sm:text-5xl font-black text-center mb-3">
                                    <span
                                        className="bg-clip-text text-transparent"
                                        style={{
                                            backgroundImage:
                                                "linear-gradient(135deg, #c084fc, #f472b6, #fb923c, #38bdf8)",
                                        }}
                                    >
                                        {t("discover.galleryTitle")}
                                    </span>
                                </h1>
                                <p className="text-center text-purple-300/70 text-lg max-w-xl mx-auto mb-8">
                                    {t("discover.gallerySubtitle")}
                                </p>

                                {/* Glassmorphism filter bar */}
                                <div className="flex justify-center mb-8">
                                    <div
                                        className="inline-flex gap-1 p-1.5 rounded-full"
                                        style={{
                                            background: "rgba(255,255,255,0.06)",
                                            backdropFilter: "blur(16px)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                        }}
                                    >
                                        {(
                                            [
                                                { key: "all", label: t("discover.filterAll"), icon: Filter },
                                                { key: "stories", label: t("discover.filterStories"), icon: Sparkles },
                                                { key: "lessons", label: t("discover.filterLessons"), icon: BookOpen },
                                            ] as const
                                        ).map(({ key, label, icon: Icon }) => (
                                            <button
                                                key={key}
                                                onClick={() => {
                                                    setFilter(key);
                                                    setVisibleCount(12);
                                                }}
                                                className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${filter === key
                                                    ? "bg-white/15 text-white shadow-lg shadow-purple-500/10"
                                                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                                                    }`}
                                            >
                                                <Icon className="size-4" />
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Cards grid */}
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                            >
                                <AnimatePresence mode="popLayout">
                                    {visibleItems.map((item) => {
                                        const isStory = item.type === "story";
                                        const linkTo = localizedPath(isStory
                                            ? `/story/${item.slug || item.id}`
                                            : `/lesson/${item.slug || item.id}`);

                                        return (
                                            <motion.div
                                                key={item.id}
                                                layoutId={`card-${item.id}`}
                                                initial={{ opacity: 0, y: 30 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 20 }}
                                                transition={{
                                                    layout: { duration: 0.7, type: "spring", stiffness: 80, damping: 18 },
                                                    opacity: { duration: 0.4 },
                                                    y: { duration: 0.4 },
                                                }}
                                            >
                                                <Link to={linkTo} className="block group">
                                                    <div
                                                        className="relative rounded-2xl overflow-hidden transition-all duration-500 group-hover:scale-[1.03] group-hover:shadow-2xl"
                                                        style={{
                                                            background:
                                                                "linear-gradient(145deg, rgba(30,15,60,0.9), rgba(15,8,40,0.95))",
                                                            border: "1px solid rgba(255,255,255,0.08)",
                                                        }}
                                                    >
                                                        {/* Hover rainbow border glow */}
                                                        <div
                                                            className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"
                                                            style={{
                                                                background:
                                                                    "linear-gradient(135deg, #9333ea, #ec4899, #f97316, #3b82f6, #14b8a6, #9333ea)",
                                                                backgroundSize: "300% 300%",
                                                                filter: "blur(4px)",
                                                                animation: "gradientShift 4s ease infinite",
                                                            }}
                                                        />

                                                        {/* Image */}
                                                        <div className="aspect-[4/3] w-full overflow-hidden relative">
                                                            <img
                                                                src={item.imageUrl}
                                                                alt={item.title}
                                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                                loading="lazy"
                                                            />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                                                            {/* Type badge */}
                                                            <div className="absolute top-3 left-3">
                                                                <span
                                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md ${isStory
                                                                        ? "bg-purple-500/30 text-purple-200 border border-purple-400/30"
                                                                        : "bg-teal-500/30 text-teal-200 border border-teal-400/30"
                                                                        }`}
                                                                >
                                                                    {isStory ? (
                                                                        <Sparkles className="size-3" />
                                                                    ) : (
                                                                        <BookOpen className="size-3" />
                                                                    )}
                                                                    {isStory ? t("discover.story") : t("discover.lesson")}
                                                                </span>
                                                            </div>

                                                            {/* Rating */}
                                                            {item.rating > 0 && (
                                                                <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-200 border border-yellow-400/20 backdrop-blur-md">
                                                                    <Star className="size-3 fill-yellow-400 text-yellow-400" />
                                                                    {item.rating.toFixed(1)}
                                                                </div>
                                                            )}

                                                            {/* Title */}
                                                            <div className="absolute bottom-0 inset-x-0 p-4">
                                                                <h3 className="text-white font-bold text-lg leading-snug line-clamp-2 drop-shadow-lg group-hover:text-purple-200 transition-colors">
                                                                    {item.title}
                                                                </h3>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Link>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </motion.div>

                            {/* Load More */}
                            {visibleCount < filteredItems.length && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="flex justify-center mt-12"
                                >
                                    <button
                                        onClick={handleLoadMore}
                                        className="px-8 py-3 rounded-full text-white font-semibold transition-all duration-300 hover:scale-105"
                                        style={{
                                            background:
                                                "linear-gradient(135deg, rgba(147,51,234,0.4), rgba(236,72,153,0.4))",
                                            border: "1px solid rgba(255,255,255,0.15)",
                                            backdropFilter: "blur(8px)",
                                        }}
                                    >
                                        {t("discover.loadMore")}
                                    </button>
                                </motion.div>
                            )}

                            {/* Empty state */}
                            {filteredItems.length === 0 && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center py-20"
                                >
                                    <Sparkles className="size-12 text-purple-400 mx-auto mb-4 opacity-50" />
                                    <p className="text-purple-300/60 text-lg">
                                        {filter === "stories" ? t("discover.noStories") : t("discover.noLessons")}
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    </div>
                )}
            </LayoutGroup>
        </div>
    );
}
