/**
 * Rewrite a Supabase Storage public "object" URL to the on-the-fly render/transform
 * endpoint with the given query params. Returns the input unchanged if it isn't a
 * Supabase object URL (e.g. an external or already-transformed URL).
 *
 * Supabase renders the transform at request time — no extra upload needed. This is how
 * we keep images small on the wire now that the native `sharp` resize is gone from the
 * server (sharp cannot run on Cloudflare Workers). Stored originals are the raw DALL·E
 * PNGs; every delivery path goes through a transform.
 */
function toTransformUrl(imageUrl: string, query: string): string {
    if (!imageUrl || !imageUrl.includes('/storage/v1/object/')) return imageUrl;
    return imageUrl.replace('/storage/v1/object/', '/storage/v1/render/image/') + query;
}

/**
 * Sized for OG/social previews (1200×630 cover crop).
 */
export function toOgImageUrl(imageUrl: string): string {
    return toTransformUrl(imageUrl, '?width=1200&height=630&resize=cover&quality=20&format=origin');
}

/**
 * Sized for in-app display (cards, detail views). Pass the intended render width; height
 * is left free so aspect ratio is preserved. Quality 60 is a good size/quality balance for
 * illustrations. Use this wherever a creation image is shown so we don't ship 2–4MB PNGs.
 */
export function toDisplayImageUrl(imageUrl: string, width: number = 800): string {
    return toTransformUrl(imageUrl, `?width=${width}&quality=60`);
}
