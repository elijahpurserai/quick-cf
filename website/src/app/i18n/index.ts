import en from "./en.json";
import he from "./he.json";
import { SUPPORTED_LANGUAGES } from "../config";

export type LangCode = string;

const dictionaries: Record<string, Record<string, string>> = { en, he };

// RTL languages
export const RTL_LANGUAGES = ["he", "ar"];

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
