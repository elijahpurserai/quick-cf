import { supabase } from "./supabase";

/**
 * Languages that have full UI translations and therefore get their own
 * URL prefix, sitemaps and hreflang alternates.
 *
 * Content can be generated in many more languages (see the frontend's
 * SUPPORTED_LANGUAGES), but only these have a real localized site.
 */
export const UI_LANGS = ["en", "he"];

/** Fallback language used when a creation has no language recorded. */
export const DEFAULT_LANG = "en";

/** Languages rendered right-to-left. */
export const RTL_LANGS = ["he", "ar"];

export function isUiLang(lang: string | undefined | null): boolean {
    return !!lang && UI_LANGS.includes(lang);
}

/**
 * The URL language prefix a piece of content belongs under.
 *
 * Content in a language we don't have a localized site for (e.g. a Spanish
 * story) lives under the default prefix — we have no /es site to send it to.
 */
export function urlLangForContent(contentLang: string | undefined | null): string {
    return isUiLang(contentLang) ? (contentLang as string) : DEFAULT_LANG;
}

/**
 * Look up the content language of a public story/lesson by slug.
 *
 * Returns null when the creation doesn't exist (caller should fall through
 * rather than redirect). Used by the language-reconciliation redirect so a
 * Hebrew story is never served — or indexed — under /en/.
 */
export async function fetchContentLang(
    type: "story" | "lesson",
    slug: string
): Promise<string | null> {
    const table = type === "story" ? "stories" : "lessons";

    const { data, error } = await supabase
        .from("creations")
        .select(`id, ${table}(language)`)
        .eq("slug", slug)
        .eq("type", type)
        .maybeSingle();

    if (error || !data) return null;

    const detail = (data as any)[table];
    const language = Array.isArray(detail) ? detail[0]?.language : detail?.language;
    return language || DEFAULT_LANG;
}

/**
 * Tag slugs that have at least one public creation, grouped by language.
 *
 * A tag on a Hebrew-only story must not appear under /en/cat/ — that page is
 * guaranteed to render empty, because both the API and the bot prerender
 * filter tagged content by language.
 *
 * Computed for all requested languages in a single pass: the sitemap needs
 * every language's set anyway (to decide hreflang alternates), and re-querying
 * creations + creation_tags per language burns Worker subrequests for nothing.
 */
export async function fetchTagSlugsByLang(
    langs: string[] = UI_LANGS
): Promise<Map<string, Set<string>>> {
    const result = new Map<string, Set<string>>(langs.map(l => [l, new Set<string>()]));

    // 1. Public creations, keyed by language.
    const { data: creations, error: crError } = await supabase
        .from("creations")
        .select("id, stories(language), lessons(language)")
        .eq("visibility", "public")
        .limit(10000);

    if (crError) throw crError;

    const langByCreation = new Map<string, string>();
    for (const c of (creations || []) as any[]) {
        const detail = c.stories || c.lessons;
        const language = Array.isArray(detail) ? detail[0]?.language : detail?.language;
        if (language && result.has(language)) langByCreation.set(c.id, language);
    }

    if (langByCreation.size === 0) return result;

    // 2. Tag ids per language.
    const { data: ctData, error: ctError } = await supabase
        .from("creation_tags")
        .select("tag_id, creation_id")
        .limit(20000);

    if (ctError) throw ctError;

    const langsByTagId = new Map<string, Set<string>>();
    for (const ct of (ctData || []) as any[]) {
        const language = langByCreation.get(ct.creation_id);
        if (!language) continue;
        const set = langsByTagId.get(ct.tag_id) || new Set<string>();
        set.add(language);
        langsByTagId.set(ct.tag_id, set);
    }

    if (langsByTagId.size === 0) return result;

    // 3. Resolve tag ids to slugs.
    const { data: tags, error: tagError } = await supabase
        .from("tags")
        .select("id, slug")
        .in("id", [...langsByTagId.keys()]);

    if (tagError) throw tagError;

    for (const tag of (tags || []) as any[]) {
        const slug = tag.slug;
        if (!slug || slug.trim().length === 0) continue;
        for (const language of langsByTagId.get(tag.id) || []) {
            result.get(language)?.add(slug);
        }
    }

    return result;
}
