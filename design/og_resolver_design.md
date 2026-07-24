# OG Tag Injection — Resolver Registry Design

## Problems with the current approach

1. **Hardcoded types in Express**: `buildPageHtml` in `server/index.ts` knows about `story` and `lesson` specifically. Adding any new page type means editing Express.

2. **Per-type Render rewrites**: Currently there's one rewrite rule per content type (`/*/story/*`, `/*/lesson/*`). Adding a new page type means a Render config change every time.

3. **Render wildcard bug**: The current rewrites use two `*` wildcards (`/*/story/*` → `https://api.quickstory.ai/*/story/*`). Render replaces *both* destinations `*` with the last captured value, so `/he/story/slug` arrives at the API as `/slug/story/slug`. The workaround (loose regex in `match()`) is a symptom fix, not a root fix.

## Solution: one-time Render change + resolver registry

These two changes together mean **neither Render config nor Express ever need to change again** as new page types are added.

---

## Part 1 — One-time Render rewrite change

Replace all per-type rewrites with a single catch-all:

**Remove:**
```
/*/story/*   →  https://api.quickstory.ai/*/story/*
/*/lesson/*  →  https://api.quickstory.ai/*/lesson/*
```

**Add one rule:**
```
/*  →  https://api.quickstory.ai/*
```

### Why this is safe

Render static sites serve files from the build output first. The rewrite only fires if no matching file exists at that path. The React build produces `/assets/index-[hash].js`, `/assets/[hash].css`, `/images/*`, `index.html`, etc. — all of these continue to be served directly from the CDN.

SPA page paths (`/he/story/slug`, `/he/lesson/slug`, `/he/category/slug`) have no matching file in the build output, so they fall through to the rewrite and get proxied to the API — exactly as today, but for *any* path, not just the ones explicitly listed.

### Bonus: fixes the Render wildcard bug

With a single `*` in the destination, Render's substitution works correctly. `/he/story/slug` → `https://api.quickstory.ai/he/story/slug`. The path arrives at the API clean, so resolver `match()` functions can use precise regexes again instead of the current workaround.

---

## Part 2 — Resolver registry in Express

Extract OG tag logic out of `server/index.ts` into a dedicated module. `index.ts` never changes again.

### File structure

```
server/
  og/
    index.ts          ← registry loop + injectOgTags() — stable forever
    resolvers/
      story.ts        ← handles /[lang]/story/[slug]
      lesson.ts       ← handles /[lang]/lesson/[slug]
      # category.ts   ← future: just add a file, nothing else changes
```

### Interface

```typescript
// server/og/index.ts

export interface OgMeta {
    title: string;
    description: string;
    imageUrl: string;
    canonicalUrl: string;
    siteName: string;
    ogType?: string;      // default: "article"
    imageWidth?: number;
    imageHeight?: number;
}

export interface OgResolver {
    name: string;
    /** Return the slug/key if this resolver owns this path, null otherwise */
    match(path: string): string | null;
    /** Fetch OG data for the key, return null if not found */
    resolve(key: string): Promise<OgMeta | null>;
}
```

### Registry + buildPageHtml

```typescript
// server/og/index.ts  (continued)

import { storyResolver } from "./resolvers/story";
import { lessonResolver } from "./resolvers/lesson";

const resolvers: OgResolver[] = [
    storyResolver,
    lessonResolver,
    // future: categoryResolver, tagResolver, etc. — only change needed
];

export async function buildPageHtml(reqPath: string, baseHtml: string): Promise<string> {
    for (const resolver of resolvers) {
        const key = resolver.match(reqPath);
        if (!key) continue;

        try {
            const meta = await resolver.resolve(key);
            if (!meta) {
                console.warn(`[OG] ${resolver.name}: no data for key="${key}"`);
                return baseHtml;
            }
            console.log(`[OG] ${resolver.name}: injected for key="${key}"`);
            return injectOgTags(baseHtml, meta);
        } catch (err: any) {
            console.error(`[OG] ${resolver.name} error for key="${key}":`, err.message);
            return baseHtml;
        }
    }
    return baseHtml;
}

function injectOgTags(baseHtml: string, meta: OgMeta): string {
    const e = (s: string) => s.replace(/"/g, "&quot;");
    const tags = `
    <title>${meta.title}</title>
    <meta name="description" content="${e(meta.description)}">
    <link rel="canonical" href="${meta.canonicalUrl}">
    <meta property="og:title" content="${e(meta.title)}">
    <meta property="og:description" content="${e(meta.description)}">
    <meta property="og:type" content="${meta.ogType ?? "article"}">
    <meta property="og:url" content="${meta.canonicalUrl}">
    <meta property="og:image" content="${meta.imageUrl}">
    <meta property="og:image:width" content="${meta.imageWidth ?? 1024}">
    <meta property="og:image:height" content="${meta.imageHeight ?? 1024}">
    <meta property="og:site_name" content="${e(meta.siteName)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${e(meta.title)}">
    <meta name="twitter:description" content="${e(meta.description)}">
    <meta name="twitter:image" content="${meta.imageUrl}">`;
    return baseHtml.replace("<head>", `<head>${tags}`);
}
```

### Example resolver (with clean path thanks to Part 1)

```typescript
// server/og/resolvers/story.ts

import { supabase } from "../../supabase";
import type { OgResolver, OgMeta } from "../index";

const CLIENT_URL = process.env.CLIENT_URL ?? "https://quickstory.ai";

export const storyResolver: OgResolver = {
    name: "story",

    match(path) {
        // Path now arrives correctly as /he/story/slug (Render bug fixed by catch-all rewrite)
        const m = path.match(/^\/([a-z]{2})\/story\/([^/]+)$/);
        return m ? m[2] : null;  // return slug
    },

    async resolve(slug): Promise<OgMeta | null> {
        const { data: creation } = await supabase
            .from("creations")
            .select("id, title, english_title, description, image_url")
            .eq("slug", slug)
            .eq("type", "story")
            .single();
        if (!creation) return null;

        const { data: details } = await supabase
            .from("stories")
            .select("language")
            .eq("id", creation.id)
            .single();

        const lang = (details as any)?.language ?? "en";
        const title = creation.english_title || creation.title || "";

        return {
            title: `${title} | Quick Story`,
            description: creation.description || "",
            imageUrl: creation.image_url || `${CLIENT_URL}/images/og-default.png`,
            canonicalUrl: `${CLIENT_URL}/${lang}/story/${slug}`,
            siteName: "Quick Story",
        };
    },
};
```

`lessonResolver` is identical — swap `"story"` → `"lesson"` and `"stories"` → `"lessons"`.

### server/index.ts — what it looks like after migration

```typescript
import { buildPageHtml } from "./og";  // ← only change

// SPA catch-all — never needs to change again
app.get(/.*/, async (req, res) => {
    const cdnHtml = await getCdnIndexHtml();
    if (cdnHtml) {
        res.setHeader("Content-Type", "text/html");
        return res.send(await buildPageHtml(req.path, cdnHtml));
    }
    if (distPath) return res.sendFile(path.join(distPath, "index.html"));
    res.status(503).send("Frontend not built.");
});
```

---

## Adding a new page type in the future

Example: you add `/[lang]/category/[slug]` pages.

1. Create `server/og/resolvers/category.ts` — implement `match` and `resolve`
2. Add `categoryResolver` to the `resolvers` array in `server/og/index.ts`
3. Done

No Render changes. No Express changes. No env vars. No build config.

---

## Migration steps

1. **Render** (one-time): replace per-type rewrites with `/* → https://api.quickstory.ai/*`
2. **Create** `server/og/index.ts` with registry and `buildPageHtml`
3. **Create** `server/og/resolvers/story.ts` and `lesson.ts` — move logic from current `buildPageHtml`, restore the clean `^\/([a-z]{2})\/` regex
4. **In** `server/index.ts`: delete the inline `buildPageHtml`, add the import
5. Deploy and verify

---

## Tradeoffs

| | Current | This design |
|---|---|---|
| Adding a new page type | Edit Express + add Render rewrite | Add one resolver file + one import |
| Render changes needed | Per page type, forever | Once, never again |
| Render wildcard bug workaround | Required (loose regex) | Gone (single `*` rewrite is correct) |
| Express catch-all | Grows with each type | Frozen |
| Path arrives correctly | No (`/slug/story/slug`) | Yes (`/he/story/slug`) |
| Testing resolvers | Hard (tangled with Express) | Easy (each is a pure module) |
