# QuickStory.AI — Unified SEO Strategy

This document consolidates all SEO design and implementation for QuickStory.AI into a single reference. It describes the **current state** of what is implemented, followed by **suggested improvements** and **new recommendations** for multi-language support and long-tail optimization.

---

## Part 1: Current State

### 1.1 Meta Tags & Page Titles

**Implemented** in [seo.ts](file:///home/guy_kashtan/quick/website/src/app/utils/seo.ts). Every page calls `updateMetaTags()` on mount and `resetMetaTags()` on unmount via `useEffect`.

| Page | Title Pattern | Status |
|:---|:---|:---|
| Home | `QuickStory.AI - Magical Stories for Children` | ✅ |
| Story | `[Story Title] \| Quick Story` | ✅ |
| Lesson | `[Lesson Topic] \| Quick Lesson` | ✅ |
| Tag | `Stories & Lessons about [Tag Name]` | ✅ |
| Category | Dynamic per-category | ✅ |
| Top Stories | Dynamic per-age filter | ✅ |
| Library / Favorites | `[Page] \| Quick` | ✅ |
| Legal | Custom title | ✅ |
| All Stories / All Lessons | Dynamic | ✅ |

**What's set per page:**
- `document.title` — formatted with the patterns above.
- `meta[name="description"]` — from content's `description` field or a manual string.
- `meta[name="keywords"]` — dynamically expanded from tags (e.g., `adventure` → `adventure`, `adventure for children`, `adventure stories`, `adventure lessons`, `adventure story`).
- `link[rel="canonical"]` — set to `window.location.href`.
- `meta[name="robots"]` — `setNoIndex()` available for private pages.

### 1.2 Open Graph & Twitter Cards

**Implemented** in [seo.ts](file:///home/guy_kashtan/quick/website/src/app/utils/seo.ts).

| Tag | Value |
|:---|:---|
| `og:title` | Content title (without suffix) |
| `og:description` | Content description |
| `og:type` | `article` for stories/lessons, `website` otherwise |
| `twitter:card` | `summary_large_image` |
| `twitter:title` / `twitter:description` | Mirrors OG values |

**`og:image` and `twitter:image` are now implemented:**
- Client-side: [seo.ts](file:///home/guy_kashtan/quick/website/src/app/utils/seo.ts) extracts `imageUrl` from story/lesson objects. Falls back to `/images/og-default.png`.
- Server-side: [seo_prerender.ts](file:///home/guy_kashtan/quick/server/seo_prerender.ts) uses `creation.image_url` from the database for bot responses.

### 1.3 URL Slugs

**Implemented.** Both `Story` and `Lesson` types have `slug` and `englishTitle` fields ([types.ts](file:///home/guy_kashtan/quick/website/src/app/types.ts)). Slugs are generated server-side in [generator.ts](file:///home/guy_kashtan/quick/server/generator.ts) using `kebab-case-title-shortId` format. Navigation uses slugs (e.g., `/story/the-magic-forest-x5y2`).

### 1.4 Tag Pages

**Implemented.** Route `/tag/:tagSlug` renders [TagPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/TagPage.tsx), aggregating stories and lessons matching the tag. Tags on story/lesson cards are clickable links. Tags are slugified (lowercase, dashes).

### 1.5 Category Pages

**Implemented.** Route `/category/:category` renders [CategoryPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/CategoryPage.tsx) with SEO metadata.

### 1.6 Bot Pre-rendering (Server-Side)

**Implemented** in [seo_prerender.ts](file:///home/guy_kashtan/quick/server/seo_prerender.ts). Express middleware that:
- Detects **35+ bots** (Google, Bing, Facebook, Twitter, Discord, Telegram, etc.) via user-agent sniffing.
- For `/story/:slug` and `/lesson/:slug`, fetches content from Supabase and returns a **full HTML document** with `<title>`, `<meta>`, OG tags, and the actual content.
- Non-bot visitors pass through to the Vite SPA.

### 1.7 Sitemap

**Implemented.** Both visual and machine-readable sitemaps are available.

**Visual (client-side):**
- [SitemapPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/SitemapPage.tsx) — visual HTML sitemap with taxonomy links (by age, purpose, topic).
- [SitemapIndexPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/SitemapIndexPage.tsx) — full story/lesson index with keyword-rich `englishTitle` anchor text.
- [AllStoriesPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/AllStoriesPage.tsx) / [AllLessonsPage.tsx](file:///home/guy_kashtan/quick/website/src/app/pages/AllLessonsPage.tsx) — filterable full indices.

**Machine-readable (server-side):** Implemented in [sitemap.ts](file:///home/guy_kashtan/quick/server/sitemap.ts).
- `/sitemap.xml` — sitemap index pointing to 4 sub-sitemaps.
- `/sitemap-static.xml` — homepage, top pages, legal pages.
- `/sitemap-stories.xml` — all public stories from DB (up to 5,000).
- `/sitemap-lessons.xml` — all public lessons from DB (up to 5,000).
- `/sitemap-tags.xml` — all tag/category pages.
- Each entry includes `<loc>`, `<lastmod>`, `<changefreq>`, `<priority>`.
- Vite dev server proxies these from Express via [vite.config.ts](file:///home/guy_kashtan/quick/website/vite.config.ts).

### 1.8 robots.txt

**Implemented** server-side in [sitemap.ts](file:///home/guy_kashtan/quick/server/sitemap.ts). Served dynamically using `CLIENT_URL` env var.

```
User-agent: *
Allow: /
Disallow: /favorites
Disallow: /library
Sitemap: ${CLIENT_URL}/sitemap.xml
```

### 1.9 Robots Meta Tag & X-Robots-Tag Header

**Implemented.**
- `<meta name="robots" content="index, follow">` — set on every page by [seo.ts](file:///home/guy_kashtan/quick/website/src/app/utils/seo.ts).
- `X-Robots-Tag: index, follow` — HTTP header set by Express middleware in [index.ts](file:///home/guy_kashtan/quick/server/index.ts) and by Vite dev server in [vite.config.ts](file:///home/guy_kashtan/quick/website/vite.config.ts).

---

## Part 2: Suggested Improvements

These are improvements already identified in previous design documents but **not yet implemented**.

### 2.1 ~~Dynamic `sitemap.xml` Generation~~ ✅ Done

Implemented in [sitemap.ts](file:///home/guy_kashtan/quick/server/sitemap.ts). See §1.7 above.

### 2.2 ~~Fix `robots.txt`~~ ✅ Done

Now served dynamically from Express using `CLIENT_URL`. See §1.8 above.

### 2.3 ~~Social Preview Images (`og:image`)~~ ✅ Done

Implemented in both [seo.ts](file:///home/guy_kashtan/quick/website/src/app/utils/seo.ts) and [seo_prerender.ts](file:///home/guy_kashtan/quick/server/seo_prerender.ts). Uses the story/lesson's `imageUrl`. Falls back to `/images/og-default.png` (needs a branded default image created).

> [!NOTE]
> Consider generating branded OG image templates (using `satori` or `@vercel/og`) for pages without images (tag pages, category pages).

### 2.4 Schema.org Structured Data (JSON-LD)

**Priority: 🟡 Medium**

Add JSON-LD structured data to story and lesson pages:

```json
{
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  "headline": "The Brave Little Dragon",
  "description": "A magical adventure...",
  "image": "https://...",
  "author": { "@type": "Organization", "name": "QuickStory.AI" },
  "datePublished": "2025-01-15",
  "genre": "Children's Stories",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "ratingCount": "12"
  }
}
```

Also implement:
- `Course` schema for lessons.
- `BreadcrumbList` for all navigable pages.
- `FAQPage` for educational topic pages (if applicable).

### 2.5 Breadcrumb Navigation

**Priority: 🟡 Medium**

Add visible breadcrumbs to content pages (e.g., `Home > Stories > Adventure > The Brave Dragon`). Mark them up with `BreadcrumbList` schema. This improves both UX and SERP display.

### 2.6 Related Content Sections

**Priority: 🟡 Medium**

On every Story/Lesson page, add a "More like this" or "Related stories about [Tag Name]" section. Benefits:
- Keeps crawlers traversing the site.
- Increases internal link equity.
- Improves user engagement and session duration.

### 2.7 Image Optimization

**Priority: 🟢 Low**

- Serve AI-generated images in **WebP** format.
- Use `loading="lazy"` on below-the-fold images.
- Preload the hero image on story/lesson pages (`<link rel="preload">`) to improve LCP.
- Use descriptive `alt` text: `"Illustration of ${story.title} - A personalized story for children"`.

### 2.8 Canonical URL Hardening

**Priority: 🟢 Low**

- Ensure canonical URLs use the production domain (not `window.location.href` when on localhost).
- Add canonical tags in `seo_prerender.ts` for bot responses.
- Handle query parameter stripping to prevent duplicate content indexing.

---

## Part 3: Additional Recommendations

### 3.1 Multi-Language Website Support

QuickStory.AI already generates content in multiple languages (via the `language` field). To extend SEO coverage to non-English pages:

#### URL Strategy

Choose one of these approaches (ordered by SEO effectiveness):

| Approach | Example | Pros | Cons |
|:---|:---|:---|:---|
| **Subdirectory** (recommended) | `/he/story/the-brave-dragon-x5y2` | Single domain authority, easy to implement | Requires route refactoring |
| **Subdomain** | `he.quickstory.ai/story/...` | Clear separation | Dilutes domain authority |
| **Query param** | `/story/...?lang=he` | Easiest to add | Worst for SEO, not indexable |

**Recommended: Subdirectory approach** (`/{lang}/story/...`).

#### Implementation Checklist

1. **Route prefix**: Add an optional `/:lang` prefix to all routes. Default to `en` when absent.
2. **`hreflang` tags**: On every page, add `<link rel="alternate">` tags for all available language versions:
   ```html
   <link rel="alternate" hreflang="en" href="https://quickstory.ai/en/story/brave-dragon-x5y2" />
   <link rel="alternate" hreflang="he" href="https://quickstory.ai/he/story/brave-dragon-x5y2" />
   <link rel="alternate" hreflang="x-default" href="https://quickstory.ai/story/brave-dragon-x5y2" />
   ```
3. **Translated meta tags**: Set `<title>`, `<meta description>`, and OG tags in the content's language.
4. **`lang` attribute**: Set `<html lang="he">` dynamically based on the current language context.
5. **Sitemap extension**: Add `xhtml:link` entries with `hreflang` in `sitemap.xml` for each localized URL.
6. **Prerender updates**: Update `seo_prerender.ts` to serve the correct `lang` attribute in the pre-rendered HTML.
7. **Slug strategy**: Continue using `englishTitle` for slugs (URL-safe across all locales), but display the localized title in `<title>` and `<h1>`.

#### Content Considerations

- Tag pages should aggregate content in the user's selected language (or show all with language indicators).
- Avoid mixing languages on a single page — Google treats mixed-language content poorly.
- Consider translating static UI text (header, footer, buttons) for each language to keep the page linguistically consistent.

### 3.2 Long-Tail SEO Improvements

Long-tail queries (3-5+ words) drive ~70% of search traffic and have much lower competition. QuickStory.AI is well-positioned to capture queries like *"bedtime story about a dinosaur for a 4 year old"*.

#### 3.2.1 Multi-Dimensional Landing Pages

Create **intersection pages** that combine two or more attributes:

| Dimension A | Dimension B | Example URL | Target Query |
|:---|:---|:---|:---|
| Age | Theme | `/stories/age-4/adventure` | "adventure stories for 4 year olds" |
| Age | Purpose | `/stories/age-5/bedtime` | "bedtime stories for 5 year olds" |
| Topic | Level | `/lessons/science/preschool` | "science lessons for preschoolers" |
| Theme | Character | `/stories/tag/dragons/age-6` | "dragon stories for 6 year olds" |

Each page should have:
- A unique `<h1>` containing the target keyword phrase.
- An introductory paragraph (2-3 sentences) with natural keyword usage.
- A grid of matching content.
- Internal links to related intersections.

#### 3.2.2 Programmatic SEO Pages

Generate template-based landing pages at scale for common query patterns:

```
/stories-for-{age}-year-olds
/bedtime-stories-about-{tag}
/{tag}-lessons-for-kids
/stories-about-{tag}-for-{age}-year-olds
```

Each auto-generated page should have:
- A unique intro paragraph (can be AI-generated, one-time).
- Sorted/filtered content grid.
- Schema.org `CollectionPage` markup.

#### 3.2.3 Content Enrichment for Existing Pages

Enhance existing story/lesson pages to capture more long-tail traffic:

- **Descriptive H1 tags**: Instead of just `"The Magic Forest"`, use `"The Magic Forest — A Bedtime Adventure Story for 4 Year Olds"`.
- **FAQ sections on tag/category pages**: Add a "Common Questions" section answering queries like *"What are the best bedtime stories for 3 year olds?"* — marked up with `FAQPage` schema.
- **"Reading time" display**: Display and mark up with schema (`timeRequired`) — captures queries like "short bedtime stories" or "5 minute stories for kids".

#### 3.2.4 Blog or Resource Hub

Add a `/blog` or `/resources` section with evergreen articles targeting high-volume informational queries:

- "Best Bedtime Stories for Toddlers"
- "How to Make Bedtime Fun for Kids"  
- "Teaching Kids About Sharing Through Stories"
- "Science Experiments for Preschoolers"

These blog posts link to relevant QuickStory content, driving internal traffic and building topical authority.

#### 3.2.5 User-Generated Signals

Leverage ratings and engagement data for SEO:

- Display and mark up **star ratings** with `AggregateRating` schema (already available in data model).
- Add **"Most Popular" and "Highest Rated" pages** that target queries like "best kids stories" or "top rated bedtime stories".
- Track and display **view counts** (captures *"popular stories for kids"*).

#### 3.2.6 Link Building Through Shareability

- Add social share buttons on every story/lesson page.
- Make OG previews so compelling (branded image + title + rating) that parents share organically.
- Consider a "Share this story" feature that generates a child-safe shareable link.

---

## Implementation Priority Summary

| Priority | Item | Impact | Effort | Status |
|:---|:---|:---|:---|:---|
| ~~🔴 Critical~~ | ~~Fix `robots.txt` (production URL)~~ | High | Trivial | ✅ Done |
| ~~🔴 Critical~~ | ~~Generate `sitemap.xml` server-side~~ | High | Low | ✅ Done |
| ~~🔴 High~~ | ~~Add `og:image` / `twitter:image`~~ | High | Low | ✅ Done |
| 🟡 Medium | Schema.org JSON-LD (CreativeWork + AggregateRating) | High | Medium | |
| 🟡 Medium | Multi-dimensional landing pages | High | Medium | |
| 🟡 Medium | Breadcrumbs + BreadcrumbList schema | Medium | Low | |
| 🟡 Medium | Related content sections | Medium | Medium | |
| 🟡 Medium | Multi-language `hreflang` support | High | High | |
| 🟢 Low | Blog / resource hub | High | High | |
| 🟢 Low | FAQ schema on tag pages | Medium | Medium | |
| 🟢 Low | Dynamic OG image generation (branded fallback) | Medium | Medium | |
| 🟢 Low | Image optimization (WebP, lazy, preload) | Low | Low |
