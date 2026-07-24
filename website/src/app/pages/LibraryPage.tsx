import { useEffect } from "react";
import { useApp } from "../contexts/AppContext";
import { StoryCard } from "../components/StoryCard";
import { LessonCard } from "../components/LessonCard";
import { Library, Trash2, Sparkles, BookOpen } from "lucide-react";
import { Button } from "../components/ui/button";
import { Link } from "react-router";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { updateMetaTags, resetMetaTags } from "../utils/seo";
import { useLanguage } from "../contexts/LanguageContext";

export function LibraryPage() {
  const { user, stories, userLibrary, removeFromLibrary, lessons } = useApp();
  const { t, localizedPath } = useLanguage();

  useEffect(() => {
    updateMetaTags(
      "My Library",
      "Manage and revisit your personalized collection of stories and lessons.",
      ["library", "my stories", "my lessons"],
      "library"
    );
    return () => resetMetaTags();
  }, []);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="relative inline-block mb-4">
          <Library className="size-16 text-purple-400 mx-auto" />
          <Sparkles className="size-6 text-pink-400 absolute -top-2 -right-2 animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold mb-2">{t("library.signInTitle")}</h2>
        <p className="text-gray-600 mb-6">
          {t("library.signInDesc")}
        </p>
      </div>
    );
  }

  const libraryStories = stories.filter((story) =>
    userLibrary.includes(story.id)
  );

  const myLessons = lessons.filter((lesson) => userLibrary.includes(lesson.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 relative">
        {/* Decorative library illustration */}
        <div className="absolute top-0 end-0 w-32 h-32 opacity-10 hidden lg:block">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1648905755287-b5c721ab36c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib29rc2hlbGYlMjBsaWJyYXJ5JTIwY29sb3JmdWwlMjBhYnN0cmFjdHxlbnwxfHx8fDE3NzEyMzQ2MTd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt=""
            className="w-full h-full object-cover rounded-lg"
          />
        </div>

        <div className="flex items-center gap-3 mb-4 relative z-10">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg p-2">
            <Library className="size-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold">{t("library.title")}</h1>
        </div>
        <p className="text-xl text-gray-600">
          {t("library.subtitle")}
        </p>
      </div>

      <Tabs defaultValue="stories" className="w-full">
        <TabsList className="mb-8 w-full max-w-md grid grid-cols-2 me-auto">
          <TabsTrigger value="stories">{t("library.myStories").replace("{count}", String(libraryStories.length))}</TabsTrigger>
          <TabsTrigger value="lessons">{t("library.myLessons").replace("{count}", String(myLessons.length))}</TabsTrigger>
        </TabsList>

        <TabsContent value="stories">
          {libraryStories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {libraryStories.map((story) => (
                <div key={story.id} className="relative group">
                  <StoryCard story={story} />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-4 end-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      if (
                        confirm(
                          t("library.removeConfirm")
                        )
                      ) {
                        removeFromLibrary(story.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Library className="size-16 text-gray-300 mx-auto mb-4" />}
              title={t("library.emptyStories")}
              description={t("library.emptyStoriesDesc")}
              actionLink={localizedPath("/")}
              actionText={t("library.createStory")}
            />
          )}
        </TabsContent>

        <TabsContent value="lessons">
          {myLessons.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myLessons.map((lesson) => (
                <div key={lesson.id} className="relative group">
                  <LessonCard lesson={lesson} />
                  {/* Lesson removal logic not yet implemented in AppContext for lessons list, implies simple view for now */}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen className="size-16 text-gray-300 mx-auto mb-4" />}
              title={t("library.emptyLessons")}
              description={t("library.emptyLessonsDesc")}
              actionLink={localizedPath("/")}
              actionText={t("library.createLesson")}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ icon, title, description, actionLink, actionText }: { icon: React.ReactNode, title: string, description: string, actionLink: string, actionText: string }) {
  return (
    <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
      {icon}
      <h3 className="text-xl font-medium text-gray-700 mb-2">
        {title}
      </h3>
      <p className="text-gray-500 mb-6">
        {description}
      </p>
      <Link to={actionLink}>
        <Button>{actionText}</Button>
      </Link>
    </div>
  )
}