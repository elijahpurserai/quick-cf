import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router";
import { StoryGeneratorForm } from "../components/StoryGeneratorForm";
import { LessonGeneratorForm } from "../components/LessonGeneratorForm";
import { StoryCard } from "../components/StoryCard";
import { SafetyBanner } from "../components/SafetyBanner";
import { useApp } from "../contexts/AppContext";
import { Story, StoryFormData, LessonFormData, Lesson } from "../types";
import { TrendingUp, BookOpen, Sparkles, School } from "lucide-react";
import { LessonCard } from "../components/LessonCard";
import { Button } from "../components/ui/button";
import { Link } from "react-router";
import { toast } from "sonner";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { MagicalHero } from "../components/MagicalHero";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { api } from "../services/api";
import { trackEvent } from "../utils/analytics";
import { updateMetaTags, resetMetaTags } from "../utils/seo";
import { useLanguage } from "../contexts/LanguageContext";
import {
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  SEO_KEYWORDS,
  HOMEPAGE_ITEMS_LIMIT,
} from "../config";

function GenerationProgress({
  type,
  name,
  topic,
}: {
  type: "story" | "lesson";
  name?: string;
  topic?: string;
}) {
  const { t } = useLanguage();
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const storySteps = [
    t("home.generating.story.step1").replace("{name}", name || "your hero"),
    t("home.generating.story.step2"),
    t("home.generating.story.step3"),
    t("home.generating.story.step4"),
    t("home.generating.story.step5"),
  ];

  const lessonSteps = [
    t("home.generating.lesson.step1").replace("{topic}", topic || "the topic"),
    t("home.generating.lesson.step2"),
    t("home.generating.lesson.step3"),
    t("home.generating.lesson.step4"),
    t("home.generating.lesson.step5"),
  ];

  const steps = type === "story" ? storySteps : lessonSteps;
  const accentColor = type === "story" ? "purple" : "blue";

  // Advance stage message every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }, 8000);
    return () => clearInterval(interval);
  }, [steps.length]);

  // Advance progress bar to 90% over 35 seconds, then hold
  useEffect(() => {
    const tickMs = 350;
    const targetPct = 90;
    const totalMs = 35000;
    const increment = (targetPct / totalMs) * tickMs;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= targetPct) {
          clearInterval(interval);
          return prev;
        }
        return Math.min(prev + increment, targetPct);
      });
    }, tickMs);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      {/* Icon + glow */}
      <div className="relative">
        {type === "story" ? (
          <Sparkles className="size-16 text-purple-600 animate-pulse" />
        ) : (
          <BookOpen className="size-16 text-blue-600 animate-pulse" />
        )}
        <div
          className={`absolute inset-0 ${accentColor === "purple" ? "bg-purple-400" : "bg-blue-400"} blur-xl opacity-50 animate-ping`}
        />
      </div>

      {/* Stage message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={stageIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4 }}
          className="text-xl font-medium text-gray-700 text-center"
          dir="auto"
        >
          {steps[stageIndex]}
        </motion.p>
      </AnimatePresence>

      {/* Progress bar + time hint */}
      <div className="w-72 space-y-2">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ease-linear ${accentColor === "purple" ? "bg-purple-500" : "bg-blue-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-center" dir="auto">
          {t("home.generating.timeHint")}
        </p>
      </div>
    </div>
  );
}

export function HomePage() {
  const { stories, addStory, addLesson, user, addToLibrary, updateStory } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lang, localizedPath, t } = useLanguage();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingData, setGeneratingData] = useState<{ type: "story" | "lesson"; name?: string; topic?: string } | null>(null);
  const [activeTab, setActiveTab] = useState("story");

  const generatorRef = useRef<HTMLDivElement>(null);

  // Redirect legacy ?category= query params to /cat/ URLs
  useEffect(() => {
    const category = searchParams.get("category");
    if (category) {
      navigate(localizedPath(`/cat/${category}`), { replace: true });
      return;
    }
    const age = searchParams.get("age");
    if (age) {
      navigate(localizedPath(`/age/${age}`), { replace: true });
    }
  }, [searchParams, navigate, localizedPath]);

  // Auto-scroll to generator when it starts
  useEffect(() => {
    if (isGenerating && generatorRef.current) {
      generatorRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }, [isGenerating]);

  // SEO
  useEffect(() => {
    updateMetaTags(
      `${SITE_NAME} - ${SITE_TAGLINE}`,
      SITE_DESCRIPTION,
      SEO_KEYWORDS,
      "home"
    );
    return () => resetMetaTags();
  }, []);

  const [topStories, setTopStories] = useState<Story[]>([]);
  const [topLessons, setTopLessons] = useState<Lesson[]>([]);
  const [isLoadingTop, setIsLoadingTop] = useState(true);
  const [isLoadingTopLessons, setIsLoadingTopLessons] = useState(true);

  useEffect(() => {
    const fetchTopLessons = async () => {
      try {
        const data = await api.creations.getPublic({ limit: HOMEPAGE_ITEMS_LIMIT, sort: 'rating', type: 'lesson', lang });
        setTopLessons(data);
      } catch (error) {
        console.error("Failed to fetch top lessons:", error);
      } finally {
        setIsLoadingTopLessons(false);
      }
    };
    fetchTopLessons();
  }, [lang]);

  useEffect(() => {
    const fetchTopStories = async () => {
      try {
        const data = await api.creations.getPublic({ limit: HOMEPAGE_ITEMS_LIMIT, sort: 'rating', type: 'story', lang });
        setTopStories(data);
      } catch (error) {
        console.error("Failed to fetch top stories:", error);
      } finally {
        setIsLoadingTop(false);
      }
    };
    fetchTopStories();
  }, [lang]);

  const handleGenerateStory = async (formData: StoryFormData) => {
    setIsGenerating(true);
    setGeneratingData({ type: "story", name: formData.childName });

    try {
      const newStory = await api.stories.generate(formData, user?.id);

      addStory(newStory);
      if (user) {
        addToLibrary(newStory.id);
      }

      toast.success(t("toast.storyGenerated"));

      trackEvent("generate_story", {
        gender: formData.gender,
        age: formData.age,
        purpose: formData.purpose,
        language: formData.language,
      });

      navigate(localizedPath(`/story/${newStory.slug || newStory.id}`));
    } catch (error) {
      console.error(error);
      toast.error(t("toast.storyGenerationFailed"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateLesson = async (formData: LessonFormData) => {
    setIsGenerating(true);
    setGeneratingData({ type: "lesson", topic: formData.topic });

    try {
      const newLesson = await api.lessons.generate(formData, user?.id);

      addLesson(newLesson);
      // Optional: Add to library logic for lessons

      toast.success(t("toast.lessonGenerated"));

      trackEvent("generate_lesson", {
        level: formData.level,
        tone: formData.tone,
        language: formData.language,
      });

      navigate(localizedPath(`/lesson/${newLesson.slug || newLesson.id}`));
    } catch (error) {
      console.error(error);
      toast.error(t("toast.lessonGenerationFailed"));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">


      {/* Hero Section */}
      <MagicalHero />

      <div className="mb-16" ref={generatorRef}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-4xl mx-auto">
          <TabsList className="grid w-full h-auto grid-cols-2 mb-8">
            <TabsTrigger value="story" className="text-lg py-3">
              <Sparkles className="size-5 mr-2" />
              {t("home.quickStory")}
            </TabsTrigger>
            <TabsTrigger value="lesson" className="text-lg py-3">
              <BookOpen className="size-5 mr-2" />
              {t("home.quickLesson")}
            </TabsTrigger>
          </TabsList>

          <div className="min-h-[600px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === "story" ? (
                  <TabsContent value="story" forceMount>
                    {isGenerating ? (
                      <GenerationProgress type="story" name={generatingData?.name} />
                    ) : (
                      <StoryGeneratorForm onGenerate={handleGenerateStory} />
                    )}
                  </TabsContent>
                ) : (
                  <TabsContent value="lesson" forceMount>
                    {isGenerating ? (
                      <GenerationProgress type="lesson" topic={generatingData?.topic} />
                    ) : (
                      <LessonGeneratorForm onGenerate={handleGenerateLesson} />
                    )}
                  </TabsContent>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </Tabs>
      </div>

      {/* Quick Links to Top Stories Pages (Only shown when not in custom generation mode for simplicity, or could be kept below) */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-6 text-center">
          {t("home.exploreCollections")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to={localizedPath("/top-bedtime-stories")}>
            <div className="relative overflow-hidden rounded-lg group">
              <div className="absolute inset-0 opacity-30">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1705077917740-dacd6ed4e0d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWR0aW1lJTIwbW9vbiUyMHN0YXJzJTIwaWxsdXN0cmF0aW9ufGVufDF8fHx8MTc3MTM0NDQ3MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                variant="outline"
                className="w-full h-auto py-6 flex flex-col items-center gap-2 hover:bg-purple-50 hover:border-purple-300 relative z-10 bg-white/90 backdrop-blur-sm"
              >
                <BookOpen className="size-6 text-purple-600" />
                <span>{t("home.topBedtimeBtn")}</span>
              </Button>
            </div>
          </Link>
          <Link to={localizedPath("/top-educational-stories")}>
            <div className="relative overflow-hidden rounded-lg group">
              <div className="absolute inset-0 opacity-30">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1670523798656-eda0ea506db6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlZHVjYXRpb25hbCUyMGJvb2tzJTIwY29sb3JmdWx8ZW58MXx8fHwxNzcxMzQ0NDcxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                variant="outline"
                className="w-full h-auto py-6 flex flex-col items-center gap-2 hover:bg-green-50 hover:border-green-300 relative z-10 bg-white/90 backdrop-blur-sm"
              >
                <BookOpen className="size-6 text-green-600" />
                <span>{t("home.topEducationalBtn")}</span>
              </Button>
            </div>
          </Link>
          <Link to={localizedPath("/trending-this-week")}>
            <div className="relative overflow-hidden rounded-lg group">
              <div className="absolute inset-0 opacity-30">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1606495959511-95e96621baaa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWdpY2FsJTIwaW1hZ2luYXRpb24lMjBzcGFya2xlcyUyMHN0YXJzfGVufDF8fHx8MTc3MTM0NDQ2OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                variant="outline"
                className="w-full h-auto py-6 flex flex-col items-center gap-2 hover:bg-pink-50 hover:border-pink-300 relative z-10 bg-white/90 backdrop-blur-sm"
              >
                <TrendingUp className="size-6 text-pink-600" />
                <span>{t("home.trendingBtn")}</span>
              </Button>
            </div>
          </Link>
          <Link to={localizedPath("/most-loved-by-3-year-olds")}>
            <div className="relative overflow-hidden rounded-lg group">
              <div className="absolute inset-0 opacity-30">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1650114364551-1d0e68ef0fc2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZHJlbiUyMHBsYXlpbmclMjBhZHZlbnR1cmV8ZW58MXx8fHwxNzcxMzQ0NDcxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                variant="outline"
                className="w-full h-auto py-6 flex flex-col items-center gap-2 hover:bg-blue-50 hover:border-blue-300 relative z-10 bg-white/90 backdrop-blur-sm"
              >
                <Sparkles className="size-6 text-blue-600" />
                <span>{t("home.3yoBtn")}</span>
              </Button>
            </div>
          </Link>
        </div>
      </div>

      {/* Top Stories of All Time */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-6">{t("home.topStoriesTitle")}</h2>
        {isLoadingTop ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[400px] bg-gray-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : topStories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-12">{t("home.noStoriesYet")}</p>
        )}
      </div>

      {/* Top Lessons of All Time */}
      <div>
        <h2 className="text-3xl font-bold mb-6">{t("home.topLessonsTitle")}</h2>
        {isLoadingTopLessons ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[400px] bg-gray-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : topLessons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topLessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-12">{t("home.noLessonsYet")}</p>
        )}
      </div>

      {/* Safety Guarantee */}
      <div className="mt-16 mb-8">
        <SafetyBanner />
      </div>
    </div>
  );
}