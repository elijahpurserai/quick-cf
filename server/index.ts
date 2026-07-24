import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load env vars BEFORE importing routes that use them
dotenv.config({ path: path.resolve(__dirname, "../website/.env") });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { storyRoutes, lessonRoutes, discoveryRoutes, userRoutes } from "./routes";
import { authRoutes } from "./auth";
import { adminRoutes } from "./admin";
import { generatorRoutes } from "./generator";
import { seoPrerender } from "./seo_prerender";
import { supabase } from "./supabase";
import { sitemapRoutes } from "./sitemap";
import { testRunnerRoutes } from "./tests/runner";

const app = express();
const PORT = process.env.PORT || 3001;

const clientUrls = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(url => url.trim()).filter(Boolean)
    : [];

const allowedOrigins = [
    ...clientUrls,
    "http://localhost:5173",
    "http://localhost:5174"
];

// Derive the base domains from CLIENT_URL (e.g. "quickstory.ai" from "https://quickstory.ai")
const baseDomains = [
    "quickstory.ai",
    ...clientUrls.map(url => {
        try {
            return new URL(url).hostname;
        } catch {
            return url.replace(/\/$/, "");
        }
    })
].filter((domain): domain is string => !!domain);

console.log("Allowed Origins:", allowedOrigins);
console.log("Base Domains (subdomains allowed):", baseDomains);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server, curl, mobile apps)
        if (!origin) return callback(null, true);

        // Allow the base domains and any of their subdomains (e.g. api.*, www.*, staging.*)
        if (baseDomains.length > 0) {
            try {
                const originHost = new URL(origin).hostname;
                const isAllowedSubdomain = baseDomains.some(domain =>
                    originHost === domain || originHost.endsWith(`.${domain}`)
                );
                if (isAllowedSubdomain) {
                    return callback(null, true);
                }
            } catch { /* invalid origin URL, fall through */ }
        }

        // Allow explicitly listed origins (localhost dev servers, CLIENT_URL, etc.)
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// X-Robots-Tag header for search engines
app.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "index, follow");
    next();
});

// Sitemap & robots.txt (must be before SPA catch-all)
app.use(sitemapRoutes);

// SEO Pre-rendering for search bots
app.use(seoPrerender);

// Routes
console.log("[Server] Registering routes...");
app.use("/api/discovery", discoveryRoutes);
app.use("/api/generator", generatorRoutes);
app.use("/api", storyRoutes);
app.use("/api", lessonRoutes);
app.use("/api/me", userRoutes);
app.use("/api", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/tests", testRunnerRoutes);
console.log("[Server] Routes registered.");

app.get("/health", (req, res) => {
    res.send("Server is running");
});

// --- Base index.html source ---
// On Cloudflare, the SPA is served by the Static Assets layer; only the paths in
// wrangler.jsonc's `run_worker_first` (API, SEO files, story/lesson HTML) reach this
// Worker. For story/lesson pages we need to read the built index.html so we can inject
// OG tags into it. worker.ts exposes the Static Assets binding on globalThis.__ASSETS__.
//
// Local dev (dev.ts via nodemon) has no assets binding — Vite serves the frontend and
// proxies /api here — so we fall back to reading website/dist/index.html off disk if a
// build exists. Same-origin means the old two-service CDN-proxy hack is gone entirely.
const localDistCandidates = [
    path.resolve(__dirname, "../website/dist"),    // dev: __dirname = server/
    path.resolve(__dirname, "../../website/dist"), // ts-node/compiled: __dirname = server/dist/
    path.resolve(process.cwd(), "website/dist"),   // fallback: relative to cwd
];
const localDistPath = localDistCandidates.find(p => fs.existsSync(p));

async function getBaseIndexHtml(req: express.Request): Promise<string | null> {
    const assets = (globalThis as any).__ASSETS__;
    if (assets && typeof assets.fetch === "function") {
        try {
            const host = req.headers.host || "quickstory.ai";
            const res = await assets.fetch(new Request(`https://${host}/index.html`));
            if (res.ok) return await res.text();
            console.warn("[Server] ASSETS returned", res.status, "for /index.html");
        } catch (e: any) {
            console.warn("[Server] Failed to read index.html from ASSETS:", e.message);
        }
        return null;
    }
    // Local dev fallback: read the built index.html from disk if present.
    if (localDistPath) {
        try {
            return fs.readFileSync(path.join(localDistPath, "index.html"), "utf8");
        } catch { /* fall through */ }
    }
    return null;
}

import { toOgImageUrl } from "./image_utils";

// Inject OG/SEO meta tags into the CDN's index.html for story and lesson pages.
// This approach avoids relying on User-Agent bot detection (which breaks when the
// CDN proxy strips/replaces the UA header). Instead, every story/lesson request
// gets OG tags baked in — bots read the static meta tags, browsers run React normally.
async function buildPageHtml(reqPath: string, baseHtml: string): Promise<string> {
    // Single-origin on Cloudflare: the request path arrives clean (e.g. `/he/story/slug`),
    // so no Render-rewrite workaround is needed. This loose match (just look for /story/ or
    // /lesson/ at the end) stays safe for any /[lang]/story/[slug] shape.
    const storyMatch = reqPath.match(/\/story\/([^/]+)$/);
    const lessonMatch = reqPath.match(/\/lesson\/([^/]+)$/);
    if (!storyMatch && !lessonMatch) return baseHtml;

    const slug = (storyMatch || lessonMatch)![1];
    const type = storyMatch ? "story" : "lesson";

    try {
        const { data: creation } = await supabase
            .from("creations")
            .select("id, title, english_title, description, image_url")
            .eq("slug", slug)
            .eq("type", type)
            .single();

        if (!creation) {
            console.warn(`[OG] No creation found for ${type}/${slug}`);
            return baseHtml;
        }

        // Fetch language from the stories/lessons table (not available on creations view)
        const table = type === "story" ? "stories" : "lessons";
        const { data: details } = await supabase
            .from(table)
            .select("language")
            .eq("id", creation.id)
            .single();
        const lang = (details as any)?.language || "en";

        const clientUrl = process.env.CLIENT_URL || "https://quickstory.ai";
        const title = creation.title || creation.english_title || "";
        const description = (creation.description || "").replace(/"/g, "&quot;");
        const rawImageUrl = creation.image_url || `${clientUrl}/images/og-default.png`;
        const imageUrl = toOgImageUrl(rawImageUrl);
        const canonicalUrl = `${clientUrl}/${lang}/${type}/${slug}`;
        const siteTitle = type === "story" ? "Quick Story" : "Quick Lesson";
        const escapedTitle = title.replace(/"/g, "&quot;");

        const ogTags = `
    <!-- OG / SEO for ${type} page -->
    <title>${title} | ${siteTitle}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:title" content="${escapedTitle}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="${siteTitle}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapedTitle}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">`;

        // Inject right after <head> — before any existing title/meta so our tags take priority
        const injected = baseHtml.replace("<head>", `<head>${ogTags}`);
        console.log(`[OG] Injected tags for ${type}/${slug}`);
        return injected;
    } catch (err: any) {
        console.error(`[OG] Error building page html for ${type}/${slug}:`, err.message);
        return baseHtml;
    }
}

// SPA catch-all — must be last. Only story/lesson HTML paths are routed here (via
// wrangler.jsonc `run_worker_first`); everything else is served by Static Assets.
// Injects OG meta tags into the built index.html so social/SEO bots (WhatsApp,
// Facebook, X, etc.) see correct preview data, while browsers run the React SPA normally.
app.get(/.*/, async (req, res) => {
    const baseHtml = await getBaseIndexHtml(req);
    if (baseHtml) {
        res.setHeader("Content-Type", "text/html");
        const html = await buildPageHtml(req.path, baseHtml);
        return res.send(html);
    }
    res.status(503).send("Frontend not built. Run `npm run build` in /website.");
});

// NOTE: the app no longer calls app.listen() here. The listen call lives in the
// entry points: server/worker.ts (Cloudflare) and server/dev.ts (local Node).
// `PORT` above is retained only for backward compatibility of any importer.

export default app;
