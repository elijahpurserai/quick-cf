import { Router } from "express";
import { supabase } from "./supabase";

const sitemapRoutes = Router();

const BASE_URL = process.env.CLIENT_URL || "https://quickstory.ai";

/** Languages that have full UI translations and should get their own sitemaps */
const UI_LANGS = ["en", "he"];

// --- robots.txt ---
sitemapRoutes.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(
        `User-agent: *
Allow: /

# Disallow private user pages
Disallow: /favorites
Disallow: /library
${UI_LANGS.map(l => `Disallow: /${l}/favorites\nDisallow: /${l}/library`).join("\n")}

Sitemap: ${BASE_URL}/sitemap.xml
`);
});

// --- Helper: generate xhtml:link hreflang alternates for a path ---
function hreflangLinks(pathWithoutLang: string): string {
    return UI_LANGS.map(lang =>
        `    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE_URL}/${lang}${pathWithoutLang}"/>`
    ).concat(
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/en${pathWithoutLang}"/>`
    ).join("\n");
}

// --- XML wrapper helpers ---
function xmlUrlset(urls: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}

function xmlSitemapIndex(entries: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;
}

// --- sitemap.xml (index) ---
sitemapRoutes.get("/sitemap.xml", (_req, res) => {
    const now = new Date().toISOString().split("T")[0];

    const sitemaps: string[] = [];

    for (const lang of UI_LANGS) {
        sitemaps.push(`  <sitemap>
    <loc>${BASE_URL}/sitemap-static-${lang}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`);
        sitemaps.push(`  <sitemap>
    <loc>${BASE_URL}/sitemap-stories-${lang}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`);
        sitemaps.push(`  <sitemap>
    <loc>${BASE_URL}/sitemap-lessons-${lang}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`);
        sitemaps.push(`  <sitemap>
    <loc>${BASE_URL}/sitemap-tags-${lang}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`);
    }

    res.type("application/xml").send(xmlSitemapIndex(sitemaps.join("\n")));
});

// --- Static pages (per-language) ---
sitemapRoutes.get("/sitemap-static-:lang.xml", (req, res) => {
    const lang = req.params.lang;
    if (!UI_LANGS.includes(lang)) {
        return res.status(404).send("Not found");
    }

    const now = new Date().toISOString().split("T")[0];
    const staticPages = [
        { loc: "/", priority: "1.0", changefreq: "daily" },
        { loc: "/sitemap", priority: "0.5", changefreq: "weekly" },
        { loc: "/all-stories", priority: "0.8", changefreq: "daily" },
        { loc: "/all-lessons", priority: "0.8", changefreq: "daily" },
        { loc: "/top-bedtime-stories", priority: "0.8", changefreq: "weekly" },
        { loc: "/top-educational-stories", priority: "0.8", changefreq: "weekly" },
        { loc: "/trending-this-week", priority: "0.7", changefreq: "daily" },
        { loc: "/discover", priority: "0.7", changefreq: "daily" },
        { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
        { loc: "/terms", priority: "0.3", changefreq: "yearly" },
    ];

    const urls = staticPages.map(p => `  <url>
    <loc>${BASE_URL}/${lang}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
${hreflangLinks(p.loc)}
  </url>`).join("\n");

    res.type("application/xml").send(xmlUrlset(urls));
});

// --- Stories (per-language) ---
sitemapRoutes.get("/sitemap-stories-:lang.xml", async (req, res) => {
    const lang = req.params.lang;
    if (!UI_LANGS.includes(lang)) {
        return res.status(404).send("Not found");
    }

    try {
        // Join with stories table to filter by language
        const { data: stories, error } = await supabase
            .from("creations")
            .select("slug, updated_at, created_at, stories(language)")
            .eq("type", "story")
            .eq("visibility", "public")
            .order("created_at", { ascending: false })
            .limit(5000);

        if (error) throw error;

        // Filter by language (language lives in the joined stories table)
        const filtered = (stories || []).filter(s => {
            const detail = Array.isArray(s.stories) ? s.stories[0] : s.stories;
            return detail && (detail as any).language === lang;
        });

        const urls = filtered.map(s => {
            const lastmod = (s.updated_at || s.created_at || new Date().toISOString()).split("T")[0];
            return `  <url>
    <loc>${BASE_URL}/${lang}/story/${s.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
        }).join("\n");

        res.type("application/xml").send(xmlUrlset(urls));
    } catch (err) {
        console.error("[Sitemap] Error generating stories sitemap:", err);
        res.status(500).send("Error generating sitemap");
    }
});

// --- Lessons (per-language) ---
sitemapRoutes.get("/sitemap-lessons-:lang.xml", async (req, res) => {
    const lang = req.params.lang;
    if (!UI_LANGS.includes(lang)) {
        return res.status(404).send("Not found");
    }

    try {
        const { data: lessons, error } = await supabase
            .from("creations")
            .select("slug, updated_at, created_at, lessons(language)")
            .eq("type", "lesson")
            .eq("visibility", "public")
            .order("created_at", { ascending: false })
            .limit(5000);

        if (error) throw error;

        const filtered = (lessons || []).filter(l => {
            const detail = Array.isArray(l.lessons) ? l.lessons[0] : l.lessons;
            return detail && (detail as any).language === lang;
        });

        const urls = filtered.map(l => {
            const lastmod = (l.updated_at || l.created_at || new Date().toISOString()).split("T")[0];
            return `  <url>
    <loc>${BASE_URL}/${lang}/lesson/${l.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
        }).join("\n");

        res.type("application/xml").send(xmlUrlset(urls));
    } catch (err) {
        console.error("[Sitemap] Error generating lessons sitemap:", err);
        res.status(500).send("Error generating sitemap");
    }
});

// --- Tags (per-language) ---
sitemapRoutes.get("/sitemap-tags-:lang.xml", async (req, res) => {
    const lang = req.params.lang;
    if (!UI_LANGS.includes(lang)) {
        return res.status(404).send("Not found");
    }

    try {
        const { data: tags, error } = await supabase
            .from("tags")
            .select("slug")
            .limit(5000);

        if (error) throw error;

        const now = new Date().toISOString().split("T")[0];
        const urls = (tags || []).map(t => `  <url>
    <loc>${BASE_URL}/${lang}/cat/${t.slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
${hreflangLinks(`/cat/${t.slug}`)}
  </url>`).join("\n");

        res.type("application/xml").send(xmlUrlset(urls));
    } catch (err) {
        console.error("[Sitemap] Error generating tags sitemap:", err);
        res.status(500).send("Error generating sitemap");
    }
});

// --- Backward-compatible: old unprefixed sitemap routes redirect to English ---
sitemapRoutes.get("/sitemap-static.xml", (_req, res) => res.redirect(301, "/sitemap-static-en.xml"));
sitemapRoutes.get("/sitemap-stories.xml", (_req, res) => res.redirect(301, "/sitemap-stories-en.xml"));
sitemapRoutes.get("/sitemap-lessons.xml", (_req, res) => res.redirect(301, "/sitemap-lessons-en.xml"));
sitemapRoutes.get("/sitemap-tags.xml", (_req, res) => res.redirect(301, "/sitemap-tags-en.xml"));

export { sitemapRoutes };
