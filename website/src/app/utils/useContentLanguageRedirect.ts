import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { isUiLang, uiLangForContent } from "../i18n";

/**
 * Keep a creation's URL language prefix in sync with its actual content language.
 *
 * A Hebrew story served at /en/story/<slug> made every link built with
 * localizedPath() inherit the /en prefix — including its tag chips, which then
 * pointed at /en/cat/<hebrew-slug>. The tag API filters tagged content by
 * language, so those pages always rendered empty.
 *
 * The server 301s direct hits (see server/index.ts). This covers the SPA case,
 * where no request reaches Express: it swaps the prefix in place, preserving
 * query string and hash, without adding a history entry.
 *
 * @param contentLang the creation's own language, or undefined while loading
 */
export function useContentLanguageRedirect(contentLang: string | undefined) {
    const params = useParams<{ lang?: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (!contentLang) return;

        const urlLang = params.lang;
        const correctLang = uiLangForContent(contentLang);

        // Leave unrecognized prefixes alone — that's not a language segment.
        if (urlLang && !isUiLang(urlLang)) return;
        if (urlLang === correctLang) return;

        const withoutLang = urlLang
            ? location.pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "")
            : location.pathname;

        navigate(`/${correctLang}${withoutLang}${location.search}${location.hash}`, {
            replace: true,
        });
    }, [contentLang, params.lang, location.pathname, location.search, location.hash, navigate]);
}
