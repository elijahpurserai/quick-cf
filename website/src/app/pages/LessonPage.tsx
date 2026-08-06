import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router";
import { useApp } from "../contexts/AppContext";
import { slugifyTag } from "../utils/tags";
import { useLanguage } from "../contexts/LanguageContext";
import { useContentLanguageRedirect } from "../utils/useContentLanguageRedirect";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
    Clock,
    Calendar,
    Heart,
    ArrowLeft,
    Share2,
    Sparkles,
    BookOpen,
    Play,
    Volume2,
    Printer,
    Download,
} from "lucide-react";
import { trackEvent } from "../utils/analytics";
import { exportToPDF } from "../utils/pdfExport";
import { updateMetaTags, resetMetaTags } from "../utils/seo";
import { toast } from "sonner";
import { api } from "../services/api";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import ReactMarkdown from "react-markdown";
import { cn } from "../components/ui/utils";
import { VisibilityBadge } from "../components/VisibilityBadge";
import { Visibility } from "../types";

export function LessonPage() {
    const { identifier } = useParams();
    const [userRating, setUserRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const imageRequestStarted = useRef<string | null>(null);

    const { lessons, user, rateLesson, updateLesson } = useApp();
    const { localizedPath, t, lang } = useLanguage();

    // Persistence logic
    const [fetchedLesson, setFetchedLesson] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(false);

    const localLesson = lessons.find((l) => l.id === identifier || l.slug === identifier);
    const lesson = fetchedLesson || localLesson;

    // A lesson must be viewed under its own language prefix — otherwise every link
    // built with localizedPath() (tag chips especially) inherits the wrong one.
    useContentLanguageRedirect(lesson?.language);

    useEffect(() => {
        const fetchLesson = async () => {
            if (!localLesson && identifier) {
                setIsFetching(true);
                try {
                    const data = await api.lessons.getLessonBySlug(identifier);
                    setFetchedLesson(data);
                } catch (error) {
                    console.error("Failed to fetch lesson:", error);
                } finally {
                    setIsFetching(false);
                }
            }
        };
        fetchLesson();
    }, [identifier]);

    // Update meta tags
    useEffect(() => {
        if (lesson) {
            updateMetaTags(lesson, undefined, undefined, "lesson");
        }
        return () => {
            resetMetaTags();
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [lesson]);

    // Trigger image generation if missing
    useEffect(() => {
        if (lesson && !lesson.imageUrl && imageRequestStarted.current !== lesson.id) {
            imageRequestStarted.current = lesson.id;
            api.lessons.generateImage(lesson.topic, lesson.description || "Educational illustration for a lesson", lesson.id, lesson.imagePrompt)
                .then(imageUrl => {
                    updateLesson(lesson.id, { imageUrl });
                })
                .catch(err => {
                    console.error("Failed to generate lesson image:", err);
                    imageRequestStarted.current = null;
                });
        }
    }, [identifier, lesson?.id, lesson?.imageUrl]);

    if (isFetching) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-12 text-center">
                <div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-xl text-gray-600">{t("lesson.loading")}</p>
            </div>
        );
    }

    if (!lesson) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-12 text-center">
                <p className="text-xl text-gray-600">{t("lesson.notFound")}</p>
                <Link to={localizedPath("/")}>
                    <Button className="mt-4">{t("common.goHome")}</Button>
                </Link>
            </div>
        );
    }

    const handleRateLesson = (rating: number) => {
        if (!user) {
            toast.error(t("toast.signInToRate"));
            return;
        }
        setUserRating(rating);
        rateLesson(lesson.id, rating);
        toast.success(t("toast.rated", { rating }));
    };


    const handleListen = async () => {
        if (audioUrl) return;

        setIsGeneratingAudio(true);
        try {
            const blob = await api.lessons.generateAudio(lesson.content, "nova");
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            toast.success(t("toast.startingNarration"));

            trackEvent("narrate_lesson", {
                id: lesson.id,
                voice: "nova"
            });
        } catch (err) {
            console.error("Failed to generate audio:", err);
            toast.error(t("toast.narratorTired"));
        } finally {
            setIsGeneratingAudio(false);
        }
    };

    const handlePrint = () => {
        trackEvent("print_content", { type: "lesson", id: lesson.id });
        window.print();
    };

    const handleDownloadPDF = async () => {
        setIsGeneratingPDF(true);
        toast.info(t("toast.preparingPDF"));
        try {
            const date = lesson.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
            await exportToPDF({
                title: lesson.topic,
                content: lesson.content,
                imageUrl: lesson.imageUrl,
                metadata: [`${lesson.duration} min read`, date, ...(lesson.level ? [lesson.level] : [])],
                accentColor: "#3b82f6",
                gradientEnd: "#10b981",
                filename: lesson.topic,
                dir: lesson.language === "he" ? "rtl" : "ltr",
            });
            trackEvent("download_pdf", { type: "lesson", id: lesson.id });
        } catch (err) {
            console.error("PDF generation failed:", err);
            toast.error(t("toast.pdfFailed", { error: err instanceof Error ? err.message : String(err) }));
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success(t("toast.linkCopied"));

        trackEvent("share_content", {
            type: "lesson",
            id: lesson.id,
            platform: "clipboard"
        });
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Top Bar: Back Button + Actions */}
            <div className="flex items-center justify-between mb-6 print:hidden">
                <Link to={localizedPath("/")}>
                    <Button variant="ghost">
                        <ArrowLeft className="size-4 mr-2" />
                        {t("common.backToHome")}
                    </Button>
                </Link>

                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPDF}
                        className="text-gray-400 hover:text-blue-600"
                        title="Download as PDF"
                    >
                        <Download className={`size-5 ${isGeneratingPDF ? "animate-bounce" : ""}`} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePrint}
                        className="text-gray-400 hover:text-blue-600"
                        title={t("lesson.print")}
                    >
                        <Printer className="size-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleShare}
                        className="text-gray-400 hover:text-blue-600"
                        title={t("lesson.share")}
                    >
                        <Share2 className="size-5" />
                    </Button>
                </div>
            </div>

            {/* Lesson Header */}
            <Card className="mb-8 overflow-hidden relative border-blue-100">
                {/* Gradient top border */}
                <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-green-400 to-teal-400" />

                <CardHeader className="relative z-10 bg-blue-50/50">
                    <div>
                        <div>
                            {/* Illustration Area */}
                            <div className="mb-6 rounded-2xl overflow-hidden aspect-video relative group bg-gradient-to-br from-blue-50 to-green-50 border-2 border-dashed border-blue-100 flex items-center justify-center">
                                {lesson.imageUrl ? (
                                    <img
                                        src={lesson.imageUrl}
                                        alt={lesson.topic}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="relative">
                                            <Sparkles className="size-12 text-blue-300 animate-pulse" />
                                            <div className="absolute inset-0 bg-blue-400 blur-xl opacity-20 animate-ping" />
                                        </div>
                                        <p className="text-sm font-medium text-blue-400/80 animate-pulse">
                                            {t("lesson.paintingIllustration")}
                                        </p>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity print:hidden" />
                            </div>

                            <CardTitle className="text-3xl mb-4 text-blue-900">{lesson.topic}</CardTitle>

                            <div className="flex flex-wrap gap-2 mb-4">
                                {lesson.level && (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                        {lesson.level}
                                    </Badge>
                                )}
                                {lesson.tone && (
                                    <Badge variant="outline" className="border-blue-200 text-blue-700">
                                        {lesson.tone}
                                    </Badge>
                                )}
                                {lesson.tags?.map((tag: any) => {
                                    const tagName = typeof tag === 'string' ? tag : tag.name;
                                    const tagSlug = typeof tag === 'string' ? slugifyTag(tag) : tag.slug;
                                    return (
                                        <Link key={tagSlug} to={localizedPath(`/cat/${tagSlug}`)}>
                                            <Badge
                                                variant="outline"
                                                className="bg-green-50 text-green-700 border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                                            >
                                                #{tagName}
                                            </Badge>
                                        </Link>
                                    );
                                })}
                                <Badge variant="outline" className="flex items-center gap-1 border-gray-200">
                                    <Clock className="size-3" />
                                    {t("common.durationMin").replace("{duration}", String(lesson.duration))}
                                </Badge>
                                <Badge variant="outline" className="flex items-center gap-1 border-gray-200">
                                    <Calendar className="size-3" />
                                    {lesson.createdAt.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </Badge>
                                <VisibilityBadge
                                    visibility={lesson.visibility || "public"}
                                    isOwner={!!(user && lesson.ownerId === user.id)}
                                    creationId={lesson.id}
                                    onVisibilityChange={(v: Visibility) => {
                                        updateLesson(lesson.id, { visibility: v });
                                        setFetchedLesson((prev: any) => prev ? { ...prev, visibility: v } : prev);
                                    }}
                                />
                            </div>

                            <div className="mt-4">
                                {audioUrl ? (
                                    <div className="bg-blue-100/50 p-2 rounded-xl border border-blue-100 flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500 w-fit">
                                        <div className="bg-blue-600 p-2 rounded-full text-white shadow-sm">
                                            <Volume2 className="size-4" />
                                        </div>
                                        <audio
                                            src={audioUrl}
                                            controls
                                            className="h-8 max-w-[200px] sm:max-w-[300px]"
                                            autoPlay
                                        />
                                    </div>
                                ) : (
                                    <Button
                                        onClick={handleListen}
                                        disabled={isGeneratingAudio}
                                        variant="outline"
                                        className={cn(
                                            "rounded-full px-6 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-blue-700 print:hidden",
                                            isGeneratingAudio && "animate-pulse border-blue-400 bg-blue-50"
                                        )}
                                    >
                                        {isGeneratingAudio ? (
                                            <>
                                                <Volume2 className="size-4 mr-2 animate-bounce" />
                                                {t("lesson.warmingUp")}
                                            </>
                                        ) : (
                                            <>
                                                <Play className="size-4 mr-2" />
                                                {t("lesson.narrate")}
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-6">
                    {/* Content */}
                    <div className={cn("max-w-none", lesson.language === "he" && "text-right")} dir={lesson.language === "he" ? "rtl" : "ltr"}>
                        <ReactMarkdown
                            components={{
                                h1: ({ node, ...props }) => (
                                    <h3
                                        className="text-3xl font-bold mt-12 mb-8 text-blue-900 border-b-2 border-blue-200 pb-2 flex items-center gap-4 transition-colors hover:text-blue-950"
                                        {...props}
                                    >
                                        <BookOpen className="size-6 text-blue-500 shrink-0" />
                                        {props.children}
                                    </h3>
                                ),
                                h2: ({ node, ...props }) => (
                                    <h3
                                        className="text-2xl font-bold mt-10 mb-6 text-blue-800 border-b-2 border-blue-200 pb-2 flex items-center gap-3 transition-colors hover:text-blue-900"
                                        {...props}
                                    >
                                        <BookOpen className="size-5 text-blue-500 shrink-0" />
                                        {props.children}
                                    </h3>
                                ),
                                h3: ({ node, ...props }) => (
                                    <h3
                                        className="text-2xl font-bold mt-10 mb-6 text-blue-800 border-b-2 border-blue-200 pb-2 flex items-center gap-3 transition-colors hover:text-blue-900"
                                        {...props}
                                    >
                                        <BookOpen className="size-5 text-blue-500 shrink-0" />
                                        {props.children}
                                    </h3>
                                ),
                                h4: ({ node, ...props }) => (
                                    <h4 className="text-xl font-semibold mt-8 mb-4 text-blue-900 flex items-center gap-2" {...props}>
                                        <div className="w-1.5 h-6 bg-blue-300 rounded-full" />
                                        {props.children}
                                    </h4>
                                ),
                                p: ({ node, ...props }) => (
                                    <p className="mb-6 last:mb-0 leading-relaxed text-gray-700" {...props} />
                                ),
                                ol: ({ node, ...props }) => (
                                    <ol className="list-decimal list-outside mb-6 space-y-3 pl-8" {...props} />
                                ),
                                ul: ({ node, ...props }) => (
                                    <ul className="list-disc list-outside mb-6 space-y-3 pl-8" {...props} />
                                ),
                                li: ({ node, ...props }) => (
                                    <li className="text-gray-700 marker:text-blue-500 marker:font-bold" {...props} />
                                ),
                                hr: () => (
                                    <hr className="my-10 border-t-2 border-blue-50" />
                                ),
                            }}
                        >
                            {lesson.content}
                        </ReactMarkdown>
                    </div>
                </CardContent>
            </Card>

            {/* Rating (Simplified for now) */}
            {user && (
                <div className="text-center mt-8">
                    <p className="text-sm text-gray-500 mb-2">{t("lesson.helpImprove")}</p>
                    <div className="flex justify-center gap-1">
                        {/* Rating stars UI same as StoryPage */}
                    </div>
                </div>
            )}
        </div>
    );
}
