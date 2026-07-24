# Internationalization (i18n) Design — QuickStory.AI

This document describes the changes needed to make the entire QuickStory.AI website multi-language, not just the generated content.

---

## Current State

| Area | Language support | Status |
|:--|:--|:--|
| Story/Lesson generation | Content generated in the user-selected language (`language` field on `stories` / `lessons` tables) | ✅ Implemented |
| Slugs | Always English (`english_title` → `kebab-case-shortId`) | ✅ Implemented |
| UI text (Header, Footer, buttons, labels, SEO copy, etc.) | English only, hardcoded strings | ❌ Not implemented |
| Routing | Flat paths (e.g. `/story/:slug`, `/cat/:tagSlug`) — no language prefix | ❌ Not implemented |
| Sitemap | Single-language, no `hreflang` | ❌ Not implemented |
| Content filtering by language | None — tag pages, top stories, category pages, all-stories/all-lessons show **all languages mixed** | ❌ Not implemented |
| `<html lang>` | Set in `seo_prerender.ts` for bots on story/lesson pages only | ⚠️ Partial |

### Supported Languages (from `config.ts`)

`en`, `es`, `fr`, `de`, `it`, `pt`, `zh`, `ja`, `ko`, `ar`, `he` (11 total)

---

## Goals

1. **Language-scoped browsing** — visiting `/he/` shows Hebrew UI + only Hebrew content; `/en/` shows English UI + only English content.
2. **Language filtering on every listing page** — tag, category, top stories, discover, all-stories, all-lessons, homepage top-rated sections only show content matching the active language.
3. **Translated static UI** — Header, Footer, buttons, labels, SEO meta text, and page copy in the user's language.
4. **SEO-correct multi-language support** — `hreflang`, per-language sitemaps, `<html lang>`, language-prefixed canonical URLs.
5. **Backward compatibility** — existing unprefixed URLs (`/story/some-slug`) keep working (redirect or default to English).

---

## 1. URL Strategy

**Approach: Subdirectory prefix** (recommended by existing [seo_strategy.md](file:///home/guy_kashtan/quick/design/seo_strategy.md) §3.1).

| Pattern | Example |
|:--|:--|
| Homepage | `/en/`, `/he/` |
| Story | `/en/story/brave-dragon-x5y2`, `/he/story/brave-dragon-x5y2` |
| Tag page | `/en/cat/adventure`, `/he/cat/adventure` |
| Sitemap | `/en/sitemap`, `/he/sitemap` |
| Static pages | `/en/top-bedtime-stories`, `/he/all-stories` |
| Default (no prefix) | Redirects to `/en/...` (or auto-detect from browser `Accept-Language`) |

### Routing Changes

In [routes.tsx](file:///home/guy_kashtan/quick/website/src/app/routes.tsx), wrap the existing route tree under an optional `/:lang` prefix:

```diff
 {
-   path: "/",
+   path: "/:lang?",
    Component: RootLayout,
    children: [
      { index: true, Component: HomePage },
      { path: "story/:identifier", Component: StoryPage },
      ...
    ],
 }
```

A `LanguageProvider` context will:
- Read `:lang` from the URL params.
- Validate it against `SUPPORTED_LANGUAGES`.
- Fall back to `en` if absent/invalid.
- Expose `currentLang`, `setLang()`, and `t()` (translation helper).

### Link Helpers

Create a `useLocalizedLink()` hook (or wrap `<Link>`) so that all internal links automatically include the language prefix:

```ts
// Before: <Link to="/cat/adventure">
// After:  <Link to={localizedPath("/cat/adventure")}> → "/he/cat/adventure"
```

> [!IMPORTANT]
> Every existing `<Link to="...">` and `useNavigate()` call across all 18 pages and components must be updated to use the language-prefixed path. This is the highest-effort single change.

---

## 2. UI Translation System

### Approach: Lightweight JSON dictionaries

No heavy i18n library needed — the app has a modest amount of static text. Use a simple key-value dictionary per language.

```
website/src/app/i18n/
├── en.json      // { "header.myLibrary": "My Library", "footer.explore": "Explore", ... }
├── he.json
├── es.json
├── ...
└── index.ts     // re-exports, provides `t(key)` function
```

### What needs translation

| Component / Page | Translatable strings |
|:--|:--|
| [Header.tsx](file:///home/guy_kashtan/quick/website/src/app/components/Header.tsx) | "My Library", "Favorites", "Admin", "Generate", "Tests", "Analytics", "Prompts", "Logout" |
| [Footer.tsx](file:///home/guy_kashtan/quick/website/src/app/components/Footer.tsx) | "Explore", "Top Bedtime Stories", "Educational Stories", "Trending This Week", "All Fairy Tales", "All Lessons", "Privacy & Legal", "Sitemap", tagline, copyright |
| [HomePage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/HomePage.tsx) | Hero text, section headings ("Top Stories", "Top Lessons"), CTA buttons |
| [CategoryPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/CategoryPage.tsx) | "Back to Home", "Stories & Lessons about X", tab labels, empty states |
| [TopStoriesPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/TopStoriesPage.tsx) | Page titles/descriptions per variant, SEO paragraph |
| [AllStoriesPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/AllStoriesPage.tsx) / [AllLessonsPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/AllLessonsPage.tsx) | Headings, filter labels, empty states |
| [DiscoverPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/DiscoverPage.tsx) | All UI labels and search placeholder |
| [SitemapPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/SitemapPage.tsx) / [SitemapIndexPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/SitemapIndexPage.tsx) | Section headings, taxonomy labels |
| [StoryGeneratorForm.tsx](file:///home/guy_kashtan/quick/website/src/app/components/StoryGeneratorForm.tsx) | All form labels, placeholders, buttons |
| [LessonGeneratorForm.tsx](file:///home/guy_kashtan/quick/website/src/app/components/LessonGeneratorForm.tsx) | All form labels, placeholders, buttons |
| [StoryPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/StoryPage.tsx) / [LessonPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/LessonPage.tsx) | Static chrome (share, rate, related sections) |
| [config.ts](file:///home/guy_kashtan/quick/website/src/app/config.ts) | `SITE_TAGLINE`, `SITE_DESCRIPTION`, `SEO_KEYWORDS` — make per-language |
| [seo.ts](file:///home/guy_kashtan/quick/website/src/app/utils/seo.ts) | `resetMetaTags()` default title, keyword expansion suffixes |

### RTL Support

Hebrew (`he`) and Arabic (`ar`) require right-to-left layout:

- Set `<html dir="rtl">` dynamically when the active language is `he` or `ar`.
- Audit CSS for hardcoded `left`/`right` margins/paddings — prefer logical properties (`margin-inline-start`) or add `.rtl` overrides.
- Mirror Header layout (logo on right, nav on left).

---

## 3. Content Filtering by Language

> [!IMPORTANT]
> This is the core behavioral change: **when a user is browsing in a specific language, they should only see content in that language.**

### 3.1 Server-Side Changes

#### Discovery API — add `lang` query param

In [routes.ts](file:///home/guy_kashtan/quick/server/routes.ts), the `/discovery/public` endpoint:

```diff
 discoveryRoutes.get("/public", async (req, res) => {
-    const { type, sort = 'latest', limit = 20, offset = 0, q } = req.query;
+    const { type, sort = 'latest', limit = 20, offset = 0, q, lang } = req.query;

     let query = supabase
         .from('creations')
         .select(`...`)
         .eq('is_public', true);

+    // Filter by language via the stories/lessons join
+    if (lang && typeof lang === 'string') {
+        if (type === 'lesson') {
+            query = query.eq('lessons.language', lang);
+        } else if (type === 'story') {
+            query = query.eq('stories.language', lang);
+        }
+        // If no type filter, apply to both (requires OR logic or separate queries)
+    }
```

#### Tag Discovery — add `lang` query param

The `/discovery/tags/s/:tagSlug` endpoint should also accept `?lang=he` and filter returned creations by language.

Similarly, the `/discovery/tags` endpoint (tag list with counts) should accept `?lang=` and return counts scoped to that language only.

#### Homepage content fetching

`HomePage.tsx` fetches top stories/lessons via `api.creations.getPublic()`. Pass the active language:

```ts
api.creations.getPublic({ limit: 6, sort: 'rating', type: 'story', lang: currentLang })
```

### 3.2 Client-Side Changes

Update `api.ts` to support the `lang` parameter:

```diff
 creations: {
     getPublic: async (params: {
         type?: string, sort?: string, limit?: number,
-        offset?: number, q?: string
+        offset?: number, q?: string, lang?: string
     } = {}): Promise<any[]> => {
         const query = new URLSearchParams();
         ...
+        if (params.lang) query.append('lang', params.lang);
```

Update every page that fetches public content to pass `lang`:

| Page | API call to update |
|:--|:--|
| `HomePage` | `fetchTopStories()`, `fetchTopLessons()` |
| `TopStoriesPage` | `api.creations.getPublic(...)` |
| `CategoryPage` | `api.tags.getBySlug(tagSlug)` → add `?lang=` |
| `AllStoriesPage` | `api.creations.getPublic({type:'story', ...})` |
| `AllLessonsPage` | `api.creations.getPublic({type:'lesson', ...})` |
| `DiscoverPage` | `api.creations.getPublic(...)` |
| `SitemapIndexPage` | Content listings |

### 3.3 Edge Case: Story/Lesson in a "Wrong" Language

If a user browsing in English navigates directly to a Hebrew story (e.g. via a shared link), the story should **still render**. The language filtering only affects discovery/listing pages, not individual content pages.

Optionally, show a subtle banner: _"This story was written in Hebrew"_ with a link to switch language context.

---

## 4. Sitemap Changes

### 4.1 Per-Language Story/Lesson Sitemaps

In [sitemap.ts](file:///home/guy_kashtan/quick/server/sitemap.ts), generate **per-language sitemaps**:

```
/sitemap.xml                   → index pointing to all sub-sitemaps
/sitemap-static-en.xml         → /en/, /en/sitemap, /en/all-stories, ...
/sitemap-static-he.xml         → /he/, /he/sitemap, /he/all-stories, ...
/sitemap-stories-en.xml        → all English stories
/sitemap-stories-he.xml        → all Hebrew stories
/sitemap-lessons-en.xml        → all English lessons
/sitemap-tags-en.xml           → /en/cat/adventure, /en/cat/kindness, ...
/sitemap-tags-he.xml           → /he/cat/adventure, /he/cat/kindness, ...
```

The story/lesson sitemaps must **join with the language table** to filter:

```sql
SELECT c.slug, c.updated_at, s.language
FROM creations c
JOIN stories s ON s.id = c.id
WHERE c.is_public = true AND s.language = 'en'
```

### 4.2 `hreflang` Annotations

Each URL entry should include `xhtml:link` alternates:

```xml
<url>
  <loc>https://quickstory.ai/en/story/brave-dragon-x5y2</loc>
  <xhtml:link rel="alternate" hreflang="en"
    href="https://quickstory.ai/en/story/brave-dragon-x5y2"/>
  <xhtml:link rel="alternate" hreflang="he"
    href="https://quickstory.ai/he/story/brave-dragon-x5y2"/>
  <xhtml:link rel="alternate" hreflang="x-default"
    href="https://quickstory.ai/story/brave-dragon-x5y2"/>
</url>
```

> [!NOTE]
> For individual stories/lessons, `hreflang` alternates only apply if the **same content** exists in multiple languages. Since each story is generated once in a single language, the story URL will typically only have one language version. `hreflang` is most useful for **static pages** (homepage, sitemap, category pages) that exist in every language.

### 4.3 Static Page Sitemaps

Static pages exist once per language:

```xml
<url>
  <loc>https://quickstory.ai/en/top-bedtime-stories</loc>
  <xhtml:link rel="alternate" hreflang="en"
    href="https://quickstory.ai/en/top-bedtime-stories"/>
  <xhtml:link rel="alternate" hreflang="he"
    href="https://quickstory.ai/he/top-bedtime-stories"/>
  <xhtml:link rel="alternate" hreflang="x-default"
    href="https://quickstory.ai/top-bedtime-stories"/>
</url>
```

### 4.4 `robots.txt` Update

No change needed — the sitemap index URL stays the same.

---

## 5. SEO & Prerender Changes

### 5.1 `seo.ts` (Client-Side)

- `updateMetaTags()` — add `hreflang` `<link>` tags for the current page's available languages.
- `resetMetaTags()` — use the translated default title/description based on active language.
- Set `<html lang="xx">` and `<html dir="rtl">` dynamically.
- Canonical URL should include the language prefix: `https://quickstory.ai/he/story/...`.

### 5.2 `seo_prerender.ts` (Server-Side Bot Responses)

Update the path regex to optionally capture a language prefix:

```diff
- const storyMatch = path.match(/^\/story\/([^\/]+)$/);
+ const storyMatch = path.match(/^\/(?:([a-z]{2})\/)?story\/([^\/]+)$/);
```

Include `hreflang` `<link>` tags in the pre-rendered HTML. The `lang` attribute on `<html>` is already set from the content's language — keep that.

---

## 6. Language Switcher UX

Add a **language selector** to the Header:

- A globe icon + current language code/flag.
- Dropdown showing all `SUPPORTED_LANGUAGES`.
- Changing language navigates to the same page with the new prefix: `/en/cat/adventure` → `/he/cat/adventure`.
- Persist the user's language preference in `localStorage` for return visits.

### Auto-Detection (Optional, Phase 2)

On first visit to `/` (no language prefix):
1. Check `localStorage` for a saved preference.
2. Fall back to `navigator.language` / `Accept-Language` header.
3. Redirect to the detected language's homepage.

---

## 7. Database & Data Considerations

### No schema changes needed

Language is already stored on `stories.language` and `lessons.language`. Tags are language-agnostic (tag slugs are always English). The `creations` base table doesn't need a language column since it's always accessible via the join.

### Tag counts per language

Currently, `/discovery/tags` returns global tag counts. With language filtering, we'll need a way to query _"How many English stories are tagged 'adventure'?"_. Options:

1. **Query-time filter** (simplest): Join `creation_tags` → `creations` → `stories/lessons` and filter by language.
2. **Materialized view** (if performance matters): Create a view `tag_counts_by_language`.

Start with option 1; optimize later if tag page performance degrades.

---

## 8. Impact on Existing Pages & Links

### Pages that need language-scoped content filtering

| Page | Current behavior | Required change |
|:--|:--|:--|
| [HomePage](file:///home/guy_kashtan/quick/website/src/app/pages/HomePage.tsx) | Shows top stories/lessons from all languages | Filter by active language |
| [CategoryPage](file:///home/guy_kashtan/quick/website/src/app/pages/CategoryPage.tsx) | Shows all content for a tag | Filter by active language |
| [TopStoriesPage](file:///home/guy_kashtan/quick/website/src/app/pages/TopStoriesPage.tsx) | Shows all stories sorted by rating | Filter by active language |
| [AllStoriesPage](file:///home/guy_kashtan/quick/website/src/app/pages/AllStoriesPage.tsx) | Full story index | Filter by active language |
| [AllLessonsPage](file:///home/guy_kashtan/quick/website/src/app/pages/AllLessonsPage.tsx) | Full lesson index | Filter by active language |
| [DiscoverPage](file:///home/guy_kashtan/quick/website/src/app/pages/DiscoverPage.tsx) | Search/browse all public content | Filter by active language |
| [SitemapPage](file:///home/guy_kashtan/quick/website/src/app/pages/SitemapPage.tsx) | Links to categories/taxonomy | Generate language-prefixed links |
| [SitemapIndexPage](file:///home/guy_kashtan/quick/website/src/app/pages/SitemapIndexPage.tsx) | Full content index | Filter + language-prefixed links |

### Pages that are NOT language-filtered

| Page | Reason |
|:--|:--|
| [StoryPage](file:///home/guy_kashtan/quick/website/src/app/pages/StoryPage.tsx) / [LessonPage](file:///home/guy_kashtan/quick/website/src/app/pages/LessonPage.tsx) | Individual content — always render regardless of language context |
| [LibraryPage](file:///home/guy_kashtan/quick/website/src/app/pages/LibraryPage.tsx) | User's own content — show all languages |
| [FavoritesPage](file:///home/guy_kashtan/quick/website/src/app/pages/FavoritesPage.tsx) | User's favorites — show all languages |
| [GeneratePage](file:///home/guy_kashtan/quick/website/src/app/pages/GeneratePage.tsx) | Admin tool — keep all languages |
| [LegalPage](file:///home/guy_kashtan/quick/website/src/app/pages/LegalPage.tsx) | Legal text (English-only for now; translate later) |

### Footer/Header links

All links must be updated to include the language prefix.

---

## 9. Implementation Phases

### Phase 1 — Language Routing & Content Filtering (Highest Impact)

- Add `/:lang?` route prefix to `routes.tsx`.
- Create `LanguageContext` provider.
- Add `lang` query param to all discovery API endpoints.
- Filter content by language on all listing pages.
- Add language switcher to Header.
- Update all `<Link>` and `useNavigate()` calls.

### Phase 2 — UI Translation

- Create `i18n/` translation dictionaries.
- Replace all hardcoded strings with `t()` calls.
- Add RTL support for Hebrew/Arabic.

### Phase 3 — SEO & Sitemap

- Generate per-language sitemaps.
- Add `hreflang` annotations.
- Update `seo_prerender.ts` for language-prefixed paths.
- Update `seo.ts` canonical URLs and meta tags.

### Phase 4 — Polish

- Language auto-detection from browser.
- `localStorage` persistence.
- Translate legal page.
- Performance-optimize tag counts per language if needed.

---

## 10. Effort Estimate

| Component | Effort | Files affected |
|:--|:--|:--|
| Route prefix + LanguageContext | Medium | `routes.tsx`, `RootLayout.tsx`, new `LanguageContext.tsx` |
| Link updates across all pages | High | All 18 pages + Header + Footer + components |
| Server-side language filter | Low | `routes.ts` (3 endpoints) |
| API client `lang` param | Low | `api.ts` |
| Language switcher UI | Low | `Header.tsx` |
| Translation dictionaries (2 langs) | Medium | New `i18n/` directory |
| Full translation (11 langs) | High | `i18n/*.json` files |
| Sitemap per-language | Medium | `sitemap.ts` |
| SEO/prerender updates | Medium | `seo.ts`, `seo_prerender.ts` |
| RTL support | Medium | Global CSS, Header, various layouts |

> [!WARNING]
> The highest-risk change is updating all internal links to be language-aware. Missing even one `<Link to="/...">` will break navigation when users are on a language-prefixed URL. Consider creating a `LocalizedLink` component that wraps React Router's `Link` and auto-prefixes.
