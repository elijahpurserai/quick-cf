import en from "./en.json";
import he from "./he.json";
import { SUPPORTED_LANGUAGES } from "../config";

export type LangCode = string;

const dictionaries: Record<string, Record<string, string>> = { en, he };

// RTL languages
export const RTL_LANGUAGES = ["he", "ar"];

/**
 * Languages with a full UI translation — the only ones that get their own URL
 * prefix, sitemaps and hreflang alternates. Content can be generated in any of
 * SUPPORTED_LANGUAGES, but there is no localized site for the rest.
 *
 * Keep in sync with server/content_lang.ts UI_LANGS.
 */
export const UI_LANGS = Object.keys(dictionaries);

export function isUiLang(lang: string | undefined | null): boolean {
    return !!lang && UI_LANGS.includes(lang);
}

/**
 * The URL language prefix a piece of content belongs under. Content in a
 * language we have no localized site for falls back to the default prefix.
 */
export function uiLangForContent(contentLang: string | undefined | null): string {
    return isUiLang(contentLang) ? (contentLang as string) : DEFAULT_LANG;
}

/**
 * Look up a translation key for the given language.
 * Supports simple {placeholder} interpolation.
 */
export function translate(
    lang: LangCode,
    key: string,
    params?: Record<string, string | number>
): string {
    const dict = dictionaries[lang] || dictionaries["en"];
    let value = dict[key] ?? dictionaries["en"][key] ?? key;

    if (params) {
        for (const [k, v] of Object.entries(params)) {
            value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
    }

    return value;
}

/**
 * Validates a language code against supported languages.
 */
export function isValidLang(lang: string): boolean {
    return SUPPORTED_LANGUAGES.some((l) => l.code === lang);
}

/**
 * Default language code.
 */
export const DEFAULT_LANG = "en";
