import { useLocation, useParams } from "react-router";
import { StoryCard } from "../components/StoryCard";
import { LessonCard } from "../components/LessonCard";
import { BookOpen, TrendingUp, Sparkles, Star } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useEffect, useState } from "react";
import { updateMetaTags, resetMetaTags } from "../utils/seo";
import { api } from "../services/api";
import { Story, Lesson } from "../types";
import { useLanguage } from "../contexts/LanguageContext";

export function TopStoriesPage() {
  const location = useLocation();
  const params = useParams();
  const [stories, setStories] = useState<Story[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { lang, t } = useLanguage();

  const isAgePage = !!params.age;

  // Determine page type from URL
  const getPageConfig = () => {
    const path = location.pathname;

    // Dynamic /age/:age route
    if (params.age) {
      const ageNum = parseInt(params.age, 10);
      return {
        title: t("topStories.ageTitle", { age: ageNum }),
        description: t("topStories.ageDesc", { age: ageNum }),
        icon: Sparkles,
        color: "blue",
        filter: () => true,
      };
    }

    if (path.includes("bedtime")) {
      return {
        title: t("topStories.bedtimeTitle"),
        description: t("topStories.bedtimeDesc"),
        icon: BookOpen,
        color: "purple",
        filter: (s: any) => s.purpose === "adventure",
      };
    } else if (path.includes("educational")) {
      return {
        title: t("topStories.educationalTitle"),
        description: t("topStories.educationalDesc"),
        icon: BookOpen,
        color: "green",
        filter: (s: any) => s.purpose === "education",
      };
    } else if (path.includes("trending")) {
      return {
        title: t("topStories.trendingTitle"),
        description: t("topStories.trendingDesc"),
        icon: TrendingUp,
        color: "pink",
        filter: (s: any) => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return new Date(s.createdAt) > weekAgo;
        },
      };
    } else if (path.includes("3-year-olds")) {
      return {
        title: t("topStories.3yoTitle"),
        description: t("topStories.3yoDesc"),
        icon: Sparkles,
        color: "blue",
        filter: (s: any) => s.age === 3,
      };
    }

    return {
      title: t("topStories.defaultTitle"),
      description: t("topStories.defaultDesc"),
      icon: BookOpen,
      color: "purple",
      filter: () => true,
    };
  };

  const config = getPageConfig();
  const Icon = config.icon;

  useEffect(() => {
    const fetchContent = async () => {
      setIsLoading(true);
      try {
        const ageParam = params.age ? parseInt(params.age, 10) : undefined;
        const storyData = await api.creations.getPublic({ limit: 100, sort: 'rating', type: 'story', lang, age: ageParam });
        setStories(storyData);

        // Also fetch lessons for age pages
        if (isAgePage) {
          const lessonData = await api.creations.getPublic({ limit: 100, sort: 'rating', type: 'lesson', lang, age: ageParam });
          setLessons(lessonData);
        }
      } catch (error) {
        console.error("Failed to fetch content:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchContent();
  }, [isAgePage, lang, params.age]);

  useEffect(() => {
    updateMetaTags(
      config.title,
      config.description,
      ["top stories", "popular stories", "bedtime stories", "educational stories"],
      "library"
    );
    return () => resetMetaTags();
  }, [config.title, config.description]);

  const filteredStories = stories
    .filter(config.filter)
    .sort((a, b) => b.rating - a.rating);

  const filteredLessons = isAgePage
    ? lessons.filter(config.filter).sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-12 text-center relative">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-1/4 w-20 h-20 opacity-10 hidden lg:block">
          <Star className="size-full text-purple-500 fill-purple-500" />
        </div>
        <div className="absolute top-10 right-1/4 w-16 h-16 opacity-10 hidden lg:block">
          <Sparkles className="size-full text-pink-500" />
        </div>

        <div className="flex justify-center mb-4">
          <div
            className={`bg-gradient-to-br from-${config.color}-500 to-${config.color}-600 rounded-full p-4 shadow-lg`}
          >
            <Icon className="size-12 text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">{config.title}</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          {config.description}
        </p>
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-[400px] bg-gray-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : isAgePage ? (
        /* Age pages: show stories + lessons in tabs like CategoryPage */
        (filteredStories.length > 0 || filteredLessons.length > 0) ? (
          <Tabs defaultValue={filteredStories.length > 0 ? "stories" : "lessons"} className="w-full">
            <TabsList className="mb-8 w-full max-w-md mx-auto grid grid-cols-2">
              <TabsTrigger value="stories">{t("common.storiesCount", { count: filteredStories.length })}</TabsTrigger>
              <TabsTrigger value="lessons">{t("common.lessonsCount", { count: filteredLessons.length })}</TabsTrigger>
            </TabsList>

            <TabsContent value="stories">
              {filteredStories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredStories.map((story) => (
                    <StoryCard key={story.id} story={story} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  {t("topStories.noStoriesAge")}
                </div>
              )}
            </TabsContent>

            <TabsContent value="lessons">
              {filteredLessons.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredLessons.map((lesson) => (
                    <LessonCard key={lesson.id} lesson={lesson} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  {t("topStories.noLessonsAge")}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {t("topStories.noContentAge")}
            </p>
          </div>
        )
      ) : (
        /* Non-age pages: stories only (original behavior) */
        filteredStories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {t("topStories.noStoriesCategory")}
            </p>
          </div>
        )
      )}

      {/* SEO Content */}
      <div className="mt-16 prose max-w-none">
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-8 border border-purple-200 relative overflow-hidden">
          {/* Decorative illustration */}
          <div className="absolute top-0 right-0 w-48 h-48 opacity-10">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1769184614148-b24ac44feeab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbG91ZHMlMjBkcmVhbXklMjBwYXN0ZWx8ZW58MXx8fHwxNzcxMzQ0NTU0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
              alt=""
              className="w-full h-full object-cover rounded-full"
            />
          </div>

          <div className="relative z-10">
            <h2>{t("topStories.aboutTitle", { title: config.title })}</h2>
            <p>
              {t("topStories.aboutWelcome", { title: config.title.toLowerCase() })}
              {isAgePage
                ? " " + t("topStories.aboutAge")
                : " " + t("topStories.aboutGeneral")}
            </p>
            <p>
              {t("topStories.aboutSafety")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}