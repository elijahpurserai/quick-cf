import { Link } from "react-router";
import { Button } from "./ui/button";
import { useApp } from "../contexts/AppContext";
import { useLanguage } from "../contexts/LanguageContext";
import {
  Sparkles,
  Library,
  Heart,
  LogIn,
  LogOut,
  User,
  Shield,
  FlaskConical,
  ClipboardCheck,
  BarChart3,
  MessageSquareText,
  Globe,
  ImageIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { SUPPORTED_LANGUAGES } from "../config";

import { GoogleLogin } from "@react-oauth/google";

export function Header() {
  const { user, login, logout } = useApp();
  const { t, localizedPath, lang, setLang, isRTL } = useLanguage();

  const currentLangLabel = SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.label || lang;

  return (
    <header className="bg-gradient-to-r from-white via-purple-50/30 to-pink-50/30 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-4">
          <Link to={localizedPath("/")} className="flex items-center gap-2 group min-w-0">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg p-2 group-hover:scale-110 transition-transform">
              <Sparkles className="size-6 text-white" />
            </div>
            <span className="hidden sm:inline text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent pb-1 leading-tight whitespace-nowrap">
              QuickStory.AI
            </span>
          </Link>

          <nav className="flex items-center gap-2 md:gap-4">
            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Globe className="size-4" />
                  <span className="hidden sm:inline text-xs">{currentLangLabel}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                {SUPPORTED_LANGUAGES.map((l) => (
                  <DropdownMenuItem
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={lang === l.code ? "bg-purple-50 font-semibold" : ""}
                  >
                    {l.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {user ? (
              <>
                <Link to={localizedPath("/library")} className="hidden md:flex">
                  <Button variant="ghost" size="sm">
                    <Library className="size-4 mr-2" />
                    {t("header.myLibrary")}
                  </Button>
                </Link>
                <Link to={localizedPath("/favorites")} className="hidden md:flex">
                  <Button variant="ghost" size="sm">
                    <Heart className="size-4 mr-2" />
                    {t("header.favorites")}
                  </Button>
                </Link>
                {user.isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="hidden md:flex gap-1.5 text-amber-700 hover:text-amber-800 hover:bg-amber-50">
                        <Shield className="size-4" />
                        {t("header.admin")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={localizedPath("/generate")}>
                          <FlaskConical className="size-4 mr-2" />
                          {t("header.generate")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={localizedPath("/tests")}>
                          <ClipboardCheck className="size-4 mr-2" />
                          {t("header.tests")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={localizedPath("/analytics")}>
                          <BarChart3 className="size-4 mr-2" />
                          {t("header.analytics")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={localizedPath("/prompts")}>
                          <MessageSquareText className="size-4 mr-2" />
                          {t("header.prompts")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={localizedPath("/image-test")}>
                          <ImageIcon className="size-4 mr-2" />
                          {t("header.imageTest")}
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Avatar className="size-6">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:inline">{user.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={localizedPath("/library")}>
                        <Library className="size-4 mr-2" />
                        {t("header.myLibrary")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={localizedPath("/favorites")}>
                        <Heart className="size-4 mr-2" />
                        {t("header.favorites")}
                      </Link>
                    </DropdownMenuItem>
                    {user.isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link to={localizedPath("/generate")}>
                            <FlaskConical className="size-4 mr-2" />
                            {t("header.generate")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={localizedPath("/tests")}>
                            <ClipboardCheck className="size-4 mr-2" />
                            {t("header.tests")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={localizedPath("/analytics")}>
                            <BarChart3 className="size-4 mr-2" />
                            {t("header.analytics")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={localizedPath("/prompts")}>
                            <MessageSquareText className="size-4 mr-2" />
                            {t("header.prompts")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={localizedPath("/image-test")}>
                            <ImageIcon className="size-4 mr-2" />
                            {t("header.imageTest")}
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="size-4 mr-2" />
                      {t("header.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  if (credentialResponse.credential) {
                    login(credentialResponse.credential);
                  }
                }}
                onError={() => {
                  console.error("Login Failed");
                }}
                useOneTap
                theme="outline"
                shape="pill"
                size="medium"
              />
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}