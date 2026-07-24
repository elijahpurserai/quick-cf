# Tags Investigation & Fixes

## Date: 2025-03-25

## User Report
- "Tags seem broken"
- "I don't see any in the site map"
- "Stories stopped showing them"
- Request: make sure bots can read tag pages effectively

## Investigation Summary

### Code Is Actually Intact
After a thorough investigation, the tags code is working correctly at the code level:

- **XML Sitemap**: Tags ARE included via `sitemap-tags-{lang}.xml` (sitemap.ts lines 70-73)
- **HTML Sitemap Page**: Has hardcoded educational topic links AND a dynamic tag cloud from API
- **StoryCard**: Renders tags (lines 183-200)
- **StoryPage**: Renders tags (lines 472-487)
- **LessonCard / LessonPage**: Both render tags correctly
- **API endpoints**: Both `GET /discovery/tags` and `GET /discovery/tags/s/:tagSlug` are correct
- **Routes**: Both `/cat/:tagSlug` and `/tag/:tagSlug` map to CategoryPage

### If Tags Are Not Showing at Runtime
Since the code is correct, if tags aren't appearing, it's likely a **data issue**:
- The `tags` or `creation_tags` tables in Supabase may be empty or have stale references
- Check browser console for API errors when loading story pages or sitemap page
- Try `GET /api/discovery/tags?lang=en` directly to confirm data exists

## Real Issues Found

### 1. Bot Prerendering MISSING for Tag Pages (Critical SEO)
**File**: `server/seo_prerender.ts`

The prerender middleware only handles `/story/:slug` and `/lesson/:slug` patterns (lines 58-63). When a bot visits `/cat/sharing`, it gets the empty SPA shell — bots that don't execute JavaScript see nothing.

**Fix**: Add a `/cat/:tagSlug` handler to `seo_prerender.ts` that generates server-side HTML with proper meta tags, structured content (list of story/lesson titles+links), and schema.org markup.

### 2. CategoryPage Meta Tags Are Client-Side Only
**File**: `website/src/app/pages/CategoryPage.tsx`

Uses `updateMetaTags()` which manipulates DOM via JavaScript. Bots that don't execute JS won't see the OG/Twitter meta tags. Fixed by issue #1 above (prerender provides the meta tags for bots).

### 3. Dead Code: TagPage.tsx
**File**: `website/src/app/pages/TagPage.tsx`

Nearly identical to `CategoryPage.tsx` but never used in routes (both `/cat/` and `/tag/` map to `CategoryPage`). Should be deleted to avoid confusion.

### 4. No Tag Tests in Frontend TestsPage
**File**: `website/src/app/pages/TestsPage.tsx`

Zero tag-related tests. The server SEO tests (server/tests/seo.ts) check the XML sitemap but don't test:
- Bot prerendering of tag pages
- Tags appearing on story/lesson cards
- Tag cloud loading on sitemap page

### 5. SitemapPage Has Hardcoded English Strings
**File**: `website/src/app/pages/SitemapPage.tsx`

Violates the translation requirement. All section titles, link labels, and static text are hardcoded in English instead of using `t()`.

### 6. Unused Variable in routes.ts
**File**: `server/routes.ts` lines 652, 704

`const tags = tagData?.map(...)` is computed but never used (the `tagData` is passed directly to `mapCreationToPublic`).

## Why Tests Didn't Catch It

The existing SEO test suite checks:
- ✅ Sitemap index includes tag sitemap references
- ✅ Tags sitemap returns valid XML with `/cat/` prefix
- ✅ Bot prerender works for stories and lessons
- ❌ No test for bot prerender of tag/category pages
- ❌ No frontend test for tags rendering on story cards
- ❌ No test for tag cloud loading on sitemap page

## Changes Made

1. Added bot prerender for `/cat/:tagSlug` routes in `seo_prerender.ts`
2. Deleted unused `TagPage.tsx`
3. Added tag tests to `server/tests/seo.ts`
4. Translated hardcoded strings in `SitemapPage.tsx`
5. Removed unused `tags` variable in `routes.ts`
