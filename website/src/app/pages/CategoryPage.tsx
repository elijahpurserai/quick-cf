import { StoryCard } from "../components/StoryCard";
import { LessonCard } from "../components/LessonCard";
import { Tag, Sparkles, BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Link, useParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useEffect, useState } from "react";
import { updateMetaTags, resetMetaTags } from "../utils/seo";
import { api } from "../services/api";
import { Story, Lesson } from "../types";
import { useLanguage } from "../contexts/LanguageContext";

export function CategoryPage() {
    const { tagSlug } = useParams();
    const { lang, localizedPath, t } = useLanguage();
    const [taggedStories, setTaggedStories] = useState<Story[]>([]);
    const [taggedLessons, setTaggedLessons] = useState<Lesson[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTaggedContent = async () => {
            if (!tagSlug) return;
            setIsLoading(true);
            try {
                const data = await api.tags.getBySlug(tagSlug, lang);
                setTaggedStories(data.filter(item => item.type === 'story'));
                setTaggedLessons(data.filter(item => item.type === 'lesson'));
            } catch (error) {
                console.error("Failed to fetch tagged content:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTaggedContent();
    }, [tagSlug, lang]);

    // Format the display tag (replace dashes with spaces for better title display)
    const displayTag = tagSlug ? tagSlug.replace(/-/g, ' ') : "";

    useEffect(() => {
        if (displayTag) {
            updateMetaTags(
                displayTag,
                `Explore the best ${displayTag} stories and lessons for children. Personalized learning and fun for kids!`,
                [displayTag],
                "tag"
            );
        }
        return () => resetMetaTags();
    }, [displayTag]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8">
                <Link to={localizedPath("/")}>
                    <Button variant="ghost" className="mb-6 -ml-2">
                        <ArrowLeft className="size-4 mr-2" />
                        {t("common.backToHome")}
                    </Button>
                </Link>
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg p-2">
                        <Tag className="size-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold capitalize">{t("category.title", { tag: displayTag })}</h1>
                </div>
                <p className="text-xl text-gray-600">
                    {t("category.description", { tag: displayTag })}
                </p>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-12">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-[400px] bg-gray-100 animate-pulse rounded-2xl" />
                    ))}
                </div>
            ) : (taggedStories.length > 0 || taggedLessons.length > 0) ? (
                <Tabs defaultValue={taggedStories.length > 0 ? "stories" : "lessons"} className="w-full">
                    <TabsList className="mb-8 w-full max-w-md grid grid-cols-2">
                        <TabsTrigger value="stories">{t("common.storiesCount", { count: taggedStories.length })}</TabsTrigger>
                        <TabsTrigger value="lessons">{t("common.lessonsCount", { count: taggedLessons.length })}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="stories">
                        {taggedStories.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {taggedStories.map((story) => (
                                    <StoryCard key={story.id} story={story} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                {t("common.noStoriesFound")}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="lessons">
                        {taggedLessons.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {taggedLessons.map((lesson) => (
                                    <LessonCard key={lesson.id} lesson={lesson} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                {t("common.noLessonsFound")}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            ) : (
                <div className="text-center py-24 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <Tag className="size-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-700">{t("category.emptyTitle", { tag: displayTag })}</h2>
                    <p className="text-gray-500 mt-2 mb-8">{t("category.emptyDescription")}</p>
                    <Link to={localizedPath("/")}>
                        <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                            <Sparkles className="size-4 mr-2" />
                            {t("common.generateNow")}
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    );
}
