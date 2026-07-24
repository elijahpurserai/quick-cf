import { Link } from "react-router";
import { Sparkles, Star, Heart } from "lucide-react";
import { SITE_NAME } from "../config";
import { useLanguage } from "../contexts/LanguageContext";

export function Footer() {
  const { t, localizedPath } = useLanguage();

  return (
    <footer className="bg-gradient-to-b from-purple-50 to-pink-50 border-t border-purple-100 mt-20 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-5">
        <div className="absolute top-10 left-10">
          <Star className="size-12 text-purple-600 fill-purple-600" />
        </div>
        <div className="absolute top-20 right-20">
          <Sparkles className="size-16 text-pink-600" />
        </div>
        <div className="absolute bottom-10 left-1/3">
          <Heart className="size-10 text-blue-600 fill-blue-600" />
        </div>
        <div className="absolute bottom-20 right-1/4">
          <Star className="size-8 text-purple-600 fill-purple-600" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link to={localizedPath("/")} className="flex items-center gap-2 mb-4">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg p-2">
                <Sparkles className="size-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {SITE_NAME}
              </span>
            </Link>
            <p className="text-gray-600 max-w-md">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">{t("footer.explore")}</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to={localizedPath("/top-bedtime-stories")}
                  className="text-gray-600 hover:text-purple-600"
                >
                  {t("footer.topBedtime")}
                </Link>
              </li>
              <li>
                <Link
                  to={localizedPath("/top-educational-stories")}
                  className="text-gray-600 hover:text-purple-600"
                >
                  {t("footer.educational")}
                </Link>
              </li>
              <li>
                <Link
                  to={localizedPath("/trending-this-week")}
                  className="text-gray-600 hover:text-purple-600"
                >
                  {t("footer.trending")}
                </Link>
              </li>
              <li>
                <Link
                  to={localizedPath("/all-stories")}
                  className="text-gray-600 hover:text-purple-600 font-medium"
                >
                  {t("footer.allStories")}
                </Link>
              </li>
              <li>
                <Link
                  to={localizedPath("/all-lessons")}
                  className="text-gray-600 hover:text-purple-600 font-medium"
                >
                  {t("footer.allLessons")}
                </Link>
              </li>
            </ul>
          </div>

        </div>

        <div className="border-t border-purple-200 mt-8 pt-8 text-center text-gray-500 text-sm">
          <p className="flex items-center justify-center gap-2 flex-wrap mb-2">
            <Link to={localizedPath("/legal")} className="text-gray-400 hover:text-purple-600 transition-colors">
              {t("footer.privacyLegal")}
            </Link>
            <span className="text-gray-300">•</span>
            <Link to={localizedPath("/sitemap")} className="text-gray-400 hover:text-purple-600 transition-colors">
              {t("footer.sitemap")}
            </Link>
          </p>
          <p className="flex items-center justify-center gap-2 flex-wrap">
            <span>© 2026 {SITE_NAME}. {t("footer.rights")}</span>
            <span className="hidden sm:inline text-gray-300">•</span>
            <span className="text-gray-400">v1.05</span>
            <span className="hidden sm:inline text-gray-300">•</span>
            <span className="flex items-center gap-1 text-gray-400">
              <Heart className="size-3 fill-red-500/50 text-red-500/50" />
              {t("footer.moderated")}
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}