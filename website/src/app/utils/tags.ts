/**
 * Converts a tag name to an SEO-friendly URL slug.
 * Example: "Space Exploration" -> "space-exploration"
 */
export const slugifyTag = (tag: string): string => {
    return tag
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}\s-]/gu, '') // remove non-letter/number chars (Unicode-aware)
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};
