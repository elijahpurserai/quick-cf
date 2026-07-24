import { Link } from "react-router";
import { Book, Library, Scale, Sparkles, Moon, GraduationCap, Users, Tag } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../services/api";
import { updateMetaTags, resetMetaTags } from "../utils/seo";
import { useLanguage } from "../contexts/LanguageContext";

export function SitemapPage() {
  const [tags, setTags] = useState<{ name: string, slug: string, count: number }[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const { lang, localizedPath, t } = useLanguage();

  // Fetch tags from API
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const data = await api.tags.getAll(lang);
        setTags(data.sort((a, b) => b.count - a.count));
      } catch (error) {
        console.error("Failed to fetch tags for sitemap:", error);
      } finally {
        setIsLoadingTags(false);
      }
    };
    fetchTags();
  }, [lang]);

  const tagCloud = tags;

  useEffect(() => {
    updateMetaTags(
      "Sitemap",
      "Explore all the magical pages, story collections, and educational topics available on QuickStory.AI.",
      ["sitemap", "directory", "stories", "lessons"],
      "library" // Pattern: Page Title | Quick
    );
    return () => resetMetaTags();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-blue-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-purple-900 mb-4">
            {t("sitemapPage.title")}
          </h1>
          <p className="text-lg text-gray-600">
            {t("sitemapPage.subtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Main Pages */}
          <SitemapSection
            title={t("sitemapPage.mainPages")}
            icon={<Sparkles className="size-6" />}
            localizedPath={localizedPath}
            links={[
              { to: "/", label: t("sitemapPage.home") },
              { to: "/library", label: t("sitemapPage.myStoryLibrary") },
              { to: "/favorites", label: t("sitemapPage.myFavorites") },
            ]}
          />

          {/* Story Collections */}
          <SitemapSection
            title={t("sitemapPage.storyCollections")}
            icon={<Book className="size-6" />}
            localizedPath={localizedPath}
            links={[
              { to: "/top-bedtime-stories", label: t("sitemapPage.topBedtime") },
              { to: "/top-educational-stories", label: t("sitemapPage.topEducational") },
              { to: "/trending-this-week", label: t("sitemapPage.trendingThisWeek") },
              { to: "/most-loved-by-3-year-olds", label: t("sitemapPage.lovedBy3YearOlds") },
            ]}
          />

          {/* Educational Categories */}
          <SitemapSection
            title={t("sitemapPage.educationalTopics")}
            icon={<GraduationCap className="size-6" />}
            localizedPath={localizedPath}
            links={[
              { to: "/cat/emotional-intelligence", label: t("sitemapPage.emotionalIntelligence") },
              { to: "/cat/sharing", label: t("sitemapPage.learningToShare") },
              { to: "/cat/confidence", label: t("sitemapPage.buildingConfidence") },
              { to: "/cat/fear", label: t("sitemapPage.dealingWithFear") },
              { to: "/cat/potty-training", label: t("sitemapPage.pottyTraining") },
              { to: "/cat/first-day-school", label: t("sitemapPage.firstDaySchool") },
              { to: "/cat/bullying", label: t("sitemapPage.understandingBullying") },
              { to: "/cat/losing-tooth", label: t("sitemapPage.losingTooth") },
              { to: "/cat/bedtime-anxiety", label: t("sitemapPage.bedtimeAnxiety") },
              { to: "/cat/healthy-eating", label: t("sitemapPage.healthyEating") },
            ]}
          />

          {/* Story Types */}
          <SitemapSection
            title={t("sitemapPage.storyTypes")}
            icon={<Moon className="size-6" />}
            localizedPath={localizedPath}
            links={[
              { to: "/?type=adventure", label: t("sitemapPage.adventureStories") },
              { to: "/?type=educational", label: t("sitemapPage.educationalStories") },
              { to: "/?type=bedtime", label: t("sitemapPage.bedtimeStories") },
            ]}
          />

          {/* Age Groups */}
          <SitemapSection
            title={t("sitemapPage.storiesByAge")}
            icon={<Users className="size-6" />}
            localizedPath={localizedPath}
            links={[
              { to: "/age/2", label: t("sitemapPage.storiesForAge", { age: "2" }) },
              { to: "/age/3", label: t("sitemapPage.storiesForAge", { age: "3" }) },
              { to: "/age/4", label: t("sitemapPage.storiesForAge", { age: "4" }) },
              { to: "/age/5", label: t("sitemapPage.storiesForAge", { age: "5" }) },
              { to: "/age/6", label: t("sitemapPage.storiesForAge", { age: "6" }) },
              { to: "/age/7", label: t("sitemapPage.storiesFor7Plus") },
            ]}
          />

          {/* Full Content Indices */}
          <SitemapSection
            title={t("sitemapPage.fullContentLibraries")}
            icon={<Library className="size-6" />}
            localizedPath={localizedPath}
            links={[
              { to: "/sitemap/all-stories", label: t("sitemapPage.fullStoryIndex") },
              { to: "/sitemap/all-lessons", label: t("sitemapPage.fullLessonIndex") },
            ]}
          />

          {/* Legal & Info */}
          <SitemapSection
            title={t("sitemapPage.legalInfo")}
            icon={<Scale className="size-6" />}
            localizedPath={localizedPath}
            links={[
              { to: "/legal", label: t("sitemapPage.termsPrivacy") },
            ]}
          />
        </div>

        {/* Tag Cloud Explorer */}
        <div className="mt-12 bg-white rounded-3xl p-8 shadow-lg border border-purple-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-pink-100 rounded-lg text-pink-600">
              <Tag className="size-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{t("sitemapPage.tagExplorer")}</h2>
          </div>

          <div className="flex flex-wrap gap-3">
            {isLoadingTags ? (
              <div className="w-full text-center py-8 text-gray-400 animate-pulse">
                {t("sitemapPage.discoveringTags")}
              </div>
            ) : tagCloud.length > 0 ? (
              tagCloud.map((tag) => (
                <Link
                  key={tag.slug}
                  to={localizedPath(`/cat/${tag.slug}`)}
                  title={t("sitemapPage.tagTitle", { tag: tag.name })}
                  className="group flex items-center gap-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-4 py-2 rounded-full transition-all"
                >
                  <span className="text-slate-700 group-hover:text-indigo-700 font-medium">#{tag.name}</span>
                  <span className="text-xs bg-slate-200 group-hover:bg-indigo-200 text-slate-500 group-hover:text-indigo-600 px-2 py-0.5 rounded-full">
                    {tag.count}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-gray-500">{t("sitemapPage.noTagsFound")}</p>
            )}
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/50 backdrop-blur-sm px-6 py-3 rounded-full shadow-sm">
            <Sparkles className="size-5 text-purple-500" />
            <p className="text-gray-600">
              {t("sitemapPage.createFromHome")}{" "}
              <Link to={localizedPath("/")} className="text-purple-600 hover:text-purple-700 font-semibold underline">
                {t("sitemapPage.homepage")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SitemapSectionProps {
  title: string;
  icon: React.ReactNode;
  links: Array<{ to: string; label: string; title?: string }>;
  localizedPath: (path: string) => string;
}

function SitemapSection({ title, icon, links, localizedPath }: SitemapSectionProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
        <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      <ul className="space-y-2">
        {links.map((link, index) => (
          <li key={index}>
            <Link
              to={localizedPath(link.to)}
              title={link.title || link.label}
              className="text-gray-600 hover:text-purple-600 hover:underline transition-colors flex items-center gap-2 group"
            >
              <span className="text-purple-400 group-hover:text-purple-600">→</span>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
