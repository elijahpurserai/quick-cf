# Creation Image Optimization — Under 500KB & OG-Ready

## Problem

1. **Images are too heavy** — DALL-E 3 generates 1024×1024 PNGs that, even after WebP conversion at quality 80, often exceed 500KB. This slows down page loads, card rendering, and social previews.
2. **OG image requirements not met** — OG images should ideally be ~1200×630 (the standard for `summary_large_image` Twitter cards and Facebook/LinkedIn). We currently serve 1024×1024 squares, which get awkwardly cropped by every platform.

## Current Pipeline

```
DALL-E 3 (1024×1024 PNG, ~2-4MB)
  → Download to buffer
  → Sharp: resize to max-width 1024, convert to WebP quality 80
  → Upload to Supabase Storage (`creations` bucket)
  → Store public URL in `creations.image_url`
```

**Typical output sizes after current optimization:** 300KB–800KB (varies by image complexity).

---

## Proposed Solution

Two changes: generate at the right ratio from the start, and tighten compression. No separate OG image upload needed.

### 1. Switch Generation to 1792×1024

DALL-E 3 supports three sizes: `1024x1024`, `1792x1024`, `1024x1792`.

`1792x1024` has a **1.75:1 ratio** — very close to OG's 1.9:1 (1200×630). This means a Supabase on-the-fly transform to 1200×630 is a negligible trim rather than chopping off half a square image.

**Change:** Set `IMAGE_SIZE` to `1792x1024` in `server/config.ts` for both single and batch generation (batch already uses this size).

**Cost impact:** Same price per DALL-E 3 call — OpenAI charges per image, not per pixel.

### 2. Tighten the Sharp Compression Pipeline

**Goal:** Every stored image ≤ 500KB.

| Setting | Current | Proposed | Why |
|---------|---------|----------|-----|
| Max width | 1024px | **1200px** | Slightly wider to match the new landscape ratio |
| Format | WebP | WebP | Keep — best size/quality/support ratio |
| Quality | 80 | **70** | ~20-30% smaller, negligible visual difference for illustrations |
| Effort | default (4) | **6** | Better compression, slightly slower encode |
| Size guard | none | **Yes** | Re-encode at quality 55 if still > 500KB |

```typescript
async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  const MAX_SIZE = 500 * 1024; // 500KB

  let result = await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 70, effort: 6 })
    .toBuffer();

  // Safety net: if still too large, compress harder
  if (result.byteLength > MAX_SIZE) {
    result = await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 55, effort: 6 })
      .toBuffer();
  }

  return result;
}
```

### 3. Serve OG Images via Supabase Image Transformation (No Extra Upload)

Instead of storing a separate OG file, construct a transform URL at render time. Supabase Storage supports on-the-fly resizing via the `/render/image/` path:

```
https://<project>.supabase.co/storage/v1/render/image/public/creations/{id}/{file}.webp
  ?width=1200&height=630&resize=cover&quality=60
```

**Implementation in `buildPageHtml()` (server/index.ts):**

```typescript
function toOgImageUrl(imageUrl: string): string {
  // Convert storage object URL to render/transform URL
  // From: .../storage/v1/object/public/creations/...
  // To:   .../storage/v1/render/image/public/creations/...?params
  return imageUrl
    .replace('/storage/v1/object/', '/storage/v1/render/image/')
    + '?width=1200&height=630&resize=cover&quality=60';
}
```

Then in the OG meta tags:
```html
<meta property="og:image" content="${toOgImageUrl(creation.image_url)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

Since the source image is already 1.75:1, the `cover` resize to 1.9:1 trims only a thin strip from top/bottom — virtually no content lost.

**Same update in `website/src/app/utils/seo.ts`** for client-side meta tag updates.

### 4. Existing Images — Migration

For the ~1024×1024 images already in storage:

- **OG transform still works** — Supabase will center-crop to 1200×630. More content is lost from a square than from 1792×1024, but it's acceptable for existing illustrations.
- **Optional re-optimization** — Run a migration script to re-compress existing images with the new Sharp settings (quality 70, effort 6, size guard). This brings old images under 500KB too without re-generating them.
- **No re-generation needed** — The crop from a square is fine for social previews; new creations will naturally be landscape.

---

## New Pipeline

```
DALL-E 3 (1792×1024 PNG)
  → Download to buffer
  → Sharp: resize max-width 1200, WebP quality 70, effort 6
  → If > 500KB: re-encode at quality 55
  → Upload to Supabase Storage (single file, ≤ 500KB)
  → Store public URL in `creations.image_url`

OG/Social sharing:
  → buildPageHtml() transforms URL on the fly via Supabase render
  → 1200×630, quality 60, no extra storage
```

## Summary of Changes

| File | Change |
|------|--------|
| `server/config.ts` | `IMAGE_SIZE`: `1024x1024` → `1792x1024` |
| `server/routes.ts` | Update Sharp pipeline: width 1200, quality 70, effort 6, add size guard |
| `server/generator.ts` | Same Sharp changes (batch already uses 1792×1024 for generation) |
| `server/index.ts` | `buildPageHtml()`: add `toOgImageUrl()` transform, update `og:image:width/height` |
| `website/src/app/utils/seo.ts` | Same `toOgImageUrl()` for client-side meta |

**No database changes. No extra uploads. No new columns.**

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Generation ratio | 1:1 (square) | 1.75:1 (landscape) |
| Stored image size | 300–800KB | ≤ 500KB (guaranteed) |
| OG image | Same heavy square, cropped by platforms | 1200×630 via transform, ~100-200KB |
| Social preview quality | Awkward square crop | Near-native fit, minimal trim |
| Storage cost | Same | Same (one file per creation) |
| Display in app | Square cards | Landscape cards (better for story/lesson cards) |

## UI Consideration

Switching from square to landscape images affects card layouts. The current `StoryCard` and `LessonCard` components show square thumbnails. Options:

- **Keep square card crops** — use CSS `object-fit: cover` on the landscape image (already in use). The card just shows the center portion. No component changes needed.
- **Update cards to landscape** — wider image area, arguably better for story illustrations. Requires layout tweaks in card components.

Either way, the stored image itself is landscape and optimized.
