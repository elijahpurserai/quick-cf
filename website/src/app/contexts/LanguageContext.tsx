import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    type ReactNode,
} from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import {
    translate,
    isValidLang,
    DEFAULT_LANG,
    RTL_LANGUAGES,
    type LangCode,
} from "../i18n";

interface LanguageContextValue {
    /** Current active language code (e.g. "en", "he") */
    lang: LangCode;
    /** Switch language — navigates to the same page under the new prefix */
    setLang: (newLang: LangCode) => void;
    /** Translation helper: t("key") or t("key", { name: "Tom" }) */
    t: (key: string, params?: Record<string, string | number>) => string;
    /** Build a localized path: localizedPath("/cat/adventure") → "/he/cat/adventure" */
    localizedPath: (path: string) => string;
    /** Whether the current language is RTL */
    isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LANG_STORAGE_KEY = "qs_lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
    const params = useParams<{ lang?: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // Derive language from URL param, falling back to localStorage, then default
    const urlLang = params.lang && isValidLang(params.lang) ? params.lang : null;
    const [lang, setLangState] = useState<LangCode>(() => {
        if (urlLang) return urlLang;
        const stored = localStorage.getItem(LANG_STORAGE_KEY);
        if (stored && isValidLang(stored)) return stored;
        return DEFAULT_LANG;
    });

    // Keep lang in sync when URL param changes
    useEffect(() => {
        if (urlLang && urlLang !== lang) {
            setLangState(urlLang);
        }
    }, [urlLang]);

    // Persist preference & update <html> attributes
    useEffect(() => {
        localStorage.setItem(LANG_STORAGE_KEY, lang);
        document.documentElement.lang = lang;
        document.documentElement.dir = RTL_LANGUAGES.includes(lang) ? "rtl" : "ltr";
    }, [lang]);

    const localizedPath = useCallback(
        (path: string) => {
            // Strip any existing lang prefix
            const cleaned = path.replace(/^\/[a-z]{2}(?=\/|$)/, "");
            const normalized = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
            return `/${lang}${normalized}`;
        },
        [lang]
    );

    const setLang = useCallback(
        (newLang: LangCode) => {
            if (!isValidLang(newLang)) return;
            setLangState(newLang);

            // Navigate to the same page with the new language prefix
            const currentPath = location.pathname;
            // Remove existing lang prefix if present
            const withoutLang = currentPath.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
            navigate(`/${newLang}${withoutLang}${location.search}`, { replace: true });
        },
        [location, navigate]
    );

    const t = useCallback(
        (key: string, params?: Record<string, string | number>) =>
            translate(lang, key, params),
        [lang]
    );

    const isRTL = RTL_LANGUAGES.includes(lang);

    const value = useMemo(
        () => ({ lang, setLang, t, localizedPath, isRTL }),
        [lang, setLang, t, localizedPath, isRTL]
    );

    return (
        <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    );
}

export function useLanguage(): LanguageContextValue {
    const ctx = useContext(LanguageContext);
    if (!ctx) {
        throw new Error("useLanguage must be used inside <LanguageProvider>");
    }
    return ctx;
}
