import { useEffect } from "react";
import { useApp } from "../contexts/AppContext";
import { StoryCard } from "../components/StoryCard";
import { Heart, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { Link } from "react-router";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { updateMetaTags, resetMetaTags } from "../utils/seo";
import { useLanguage } from "../contexts/LanguageContext";

export function FavoritesPage() {
  const { user, stories, favorites } = useApp();
  const { localizedPath, t } = useLanguage();

  useEffect(() => {
    updateMetaTags(
      "My Favorites",
      "Quick access to the stories you love most.",
      ["favorites", "favorite stories"],
      "favorites"
    );
    return () => resetMetaTags();
  }, []);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="relative inline-block mb-4">
          <Heart className="size-16 text-red-400 mx-auto fill-red-400" />
          <Sparkles className="size-6 text-pink-400 absolute -top-2 -right-2 animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {t("favorites.signInTitle")}
        </h2>
        <p className="text-gray-600 mb-6">
          {t("favorites.signInDesc")}
        </p>
      </div>
    );
  }

  const favoriteStories = stories.filter((story) =>
    favorites.includes(story.id)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 relative">
        {/* Decorative hearts illustration */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10 hidden lg:block">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1644784335820-48475e385360?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFydHMlMjBsb3ZlJTIwcmVkJTIwcGlua3xlbnwxfHx8fDE3NzEzNDQ2MTh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt=""
            className="w-full h-full object-cover rounded-lg"
          />
        </div>

        <div className="flex items-center gap-3 mb-4 relative z-10">
          <div className="bg-gradient-to-br from-red-400 to-pink-500 rounded-lg p-2">
            <Heart className="size-8 text-white fill-white" />
          </div>
          <h1 className="text-4xl font-bold">{t("favorites.title")}</h1>
        </div>
        <p className="text-xl text-gray-600">
          {t("favorites.subtitle")}
        </p>
      </div>

      {favoriteStories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoriteStories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Heart className="size-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-700 mb-2">
            {t("favorites.emptyTitle")}
          </h3>
          <p className="text-gray-500 mb-6">
            {t("favorites.emptyDesc")}
          </p>
          <Link to={localizedPath("/")}>
            <Button>{t("common.browseStories")}</Button>
          </Link>
        </div>
      )}
    </div>
  );
}