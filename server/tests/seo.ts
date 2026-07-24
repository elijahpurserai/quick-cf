/**
 * SEO Test Category
 * Tests sitemap structure, robots.txt, bot prerender, and X-Robots-Tag header.
 * All tests make HTTP requests against the running server.
 */

import { TestCategory, TestResult } from "./types";

const SERVER_PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${SERVER_PORT}`;

/** Helper: make a GET request and return { status, text, headers } */
async function httpGet(path: string, headers: Record<string, string> = {}): Promise<{
    status: number;
    text: string;
    headers: Record<string, string>;
}> {
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    const text = await res.text();
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
    });
    return { status: res.status, text, headers: responseHeaders };
}

/** Helper: run a single test, catching errors */
async function runTest(name: string, fn: () => Promise<void>, onStart?: (name: string) => void): Promise<TestResult> {
    onStart?.(name);
    const start = Date.now();
    try {
        await fn();
        return { name, passed: true, message: "Passed", durationMs: Date.now() - start };
    } catch (err: any) {
        return { name, passed: false, message: err.message || String(err), durationMs: Date.now() - start };
    }
}

/** Helper: simple assertion */
function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function assertContains(text: string, substring: string, context: string = "") {
    if (!text.includes(substring)) {
        throw new Error(`Expected ${context ? context + " to contain" : "to find"} "${substring}" but it was not found`);
    }
}

function assertNotContains(text: string, substring: string, context: string = "") {
    if (text.includes(substring)) {
        throw new Error(`Expected ${context ? context + " to NOT contain" : "NOT to find"} "${substring}" but it was found`);
    }
}

function assertMatches(text: string, pattern: RegExp, context: string = "") {
    if (!pattern.test(text)) {
        throw new Error(`Expected ${context ? context + " to match" : "to match"} ${pattern} but it did not`);
    }
}

// =============================================================================
// Test definitions
// =============================================================================

async function robotsTxtTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const res = await httpGet("/robots.txt");

    results.push(await runTest("robots.txt returns 200", async () => {
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    }, onStart));

    results.push(await runTest("robots.txt has correct User-agent and Allow", async () => {
        assertContains(res.text, "User-agent: *", "robots.txt");
        assertContains(res.text, "Allow: /", "robots.txt");
    }, onStart));

    results.push(await runTest("robots.txt disallows private pages", async () => {
        assertContains(res.text, "Disallow: /favorites", "robots.txt");
        assertContains(res.text, "Disallow: /library", "robots.txt");
    }, onStart));

    results.push(await runTest("robots.txt has Sitemap directive", async () => {
        assertMatches(res.text, /Sitemap:\s+\S+\/sitemap\.xml/, "robots.txt");
        // Warn (but don't fail) if pointing to localhost — this is expected in dev
        if (res.text.includes("localhost")) {
            // This is fine in dev, but should be fixed in production
        }
    }, onStart));

    return results;
}

async function sitemapIndexTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const res = await httpGet("/sitemap.xml");

    results.push(await runTest("Sitemap index returns valid XML", async () => {
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assertContains(res.text, "<sitemapindex", "sitemap index");
        assertContains(res.text, "</sitemapindex>", "sitemap index");
    }, onStart));

    results.push(await runTest("Sitemap index references all child sitemaps", async () => {
        // Sitemaps are now per-language (e.g. sitemap-static-en.xml, sitemap-static-he.xml)
        assertContains(res.text, "sitemap-static-en.xml", "sitemap index");
        assertContains(res.text, "sitemap-stories-en.xml", "sitemap index");
        assertContains(res.text, "sitemap-lessons-en.xml", "sitemap index");
        assertContains(res.text, "sitemap-tags-en.xml", "sitemap index");
    }, onStart));

    results.push(await runTest("Sitemap index has lastmod dates", async () => {
        assertMatches(res.text, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/, "sitemap index");
    }, onStart));

    return results;
}

async function staticSitemapTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const res = await httpGet("/sitemap-static.xml");

    results.push(await runTest("Static sitemap returns valid XML", async () => {
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assertContains(res.text, "<urlset", "static sitemap");
    }, onStart));

    results.push(await runTest("Static sitemap includes important pages", async () => {
        const expectedPaths = ["/all-stories", "/all-lessons", "/top-bedtime-stories", "/top-educational-stories"];
        for (const path of expectedPaths) {
            assertContains(res.text, path, "static sitemap");
        }
    }, onStart));

    results.push(await runTest("Static sitemap excludes private pages", async () => {
        assertNotContains(res.text, "/favorites", "static sitemap");
        assertNotContains(res.text, "/library", "static sitemap");
        assertNotContains(res.text, "/generate", "static sitemap");
    }, onStart));

    results.push(await runTest("Static sitemap has priority and changefreq", async () => {
        assertMatches(res.text, /<priority>[0-9.]+<\/priority>/, "static sitemap");
        assertMatches(res.text, /<changefreq>\w+<\/changefreq>/, "static sitemap");
    }, onStart));

    return results;
}

async function contentSitemapTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const storiesRes = await httpGet("/sitemap-stories.xml");
    results.push(await runTest("Stories sitemap returns valid XML", async () => {
        assert(storiesRes.status === 200, `Expected 200, got ${storiesRes.status}`);
        assertContains(storiesRes.text, "<urlset", "stories sitemap");
    }, onStart));
    results.push(await runTest("Stories sitemap uses /story/ URL prefix", async () => {
        if (storiesRes.text.includes("<url>")) {
            assertMatches(storiesRes.text, /<loc>[^<]*\/story\/[^<]+<\/loc>/, "stories sitemap URLs");
        }
    }, onStart));

    const lessonsRes = await httpGet("/sitemap-lessons.xml");
    results.push(await runTest("Lessons sitemap returns valid XML", async () => {
        assert(lessonsRes.status === 200, `Expected 200, got ${lessonsRes.status}`);
        assertContains(lessonsRes.text, "<urlset", "lessons sitemap");
    }, onStart));
    results.push(await runTest("Lessons sitemap uses /lesson/ URL prefix", async () => {
        if (lessonsRes.text.includes("<url>")) {
            assertMatches(lessonsRes.text, /<loc>[^<]*\/lesson\/[^<]+<\/loc>/, "lessons sitemap URLs");
        }
    }, onStart));

    const tagsRes = await httpGet("/sitemap-tags.xml");
    results.push(await runTest("Tags sitemap returns valid XML", async () => {
        assert(tagsRes.status === 200, `Expected 200, got ${tagsRes.status}`);
        assertContains(tagsRes.text, "<urlset", "tags sitemap");
    }, onStart));
    results.push(await runTest("Tags sitemap uses /cat/ URL prefix", async () => {
        if (tagsRes.text.includes("<url>")) {
            assertMatches(tagsRes.text, /<loc>[^<]*\/cat\/[^<]+<\/loc>/, "tags sitemap URLs");
        }
    }, onStart));

    return results;
}

async function botPrerenderTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Discover a real story and lesson slug from the sitemaps
    const storiesRes = await httpGet("/sitemap-stories.xml");
    const storyMatch = storiesRes.text.match(/\/story\/([^<]+)</);
    const storySlug = storyMatch ? storyMatch[1] : null;

    // Also extract a language-prefixed story URL if present (e.g. /he/story/some-slug)
    const langStoryMatch = storiesRes.text.match(/\/(he|en)\/story\/([^<]+)</);
    const langStoryPath = langStoryMatch ? `/${langStoryMatch[1]}/story/${langStoryMatch[2]}` : null;

    const lessonsRes = await httpGet("/sitemap-lessons.xml");
    const lessonMatch = lessonsRes.text.match(/\/lesson\/([^<]+)</);
    const lessonSlug = lessonMatch ? lessonMatch[1] : null;

    if (storySlug) {
        const botRes = await httpGet(`/story/${storySlug}`, {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
        });

        results.push(await runTest(`Bot prerender: story page returns HTML (${storySlug.substring(0, 30)}...)`, async () => {
            assert(botRes.status === 200, `Expected 200, got ${botRes.status}`);
            assertContains(botRes.text, "<!DOCTYPE html>", "prerendered HTML");
            assertContains(botRes.text, "| Quick Story</title>", "prerendered title");
        }, onStart));

        results.push(await runTest("Bot prerender: story has OG meta tags", async () => {
            assertContains(botRes.text, 'property="og:title"', "prerendered OG");
            assertContains(botRes.text, 'property="og:description"', "prerendered OG");
            assertContains(botRes.text, 'property="og:type" content="article"', "prerendered OG");
            assertContains(botRes.text, 'property="og:image"', "prerendered OG");
        }, onStart));

        results.push(await runTest("Bot prerender: og:image has a non-empty URL", async () => {
            const match = botRes.text.match(/property="og:image"\s+content="([^"]+)"/);
            assert(!!match, 'og:image tag not found or has no content attribute');
            assert(match![1].startsWith("http"), `og:image URL should start with http, got: "${match![1]}"`);
        }, onStart));

        results.push(await runTest("Bot prerender: story has Twitter card tags", async () => {
            assertContains(botRes.text, 'name="twitter:card" content="summary_large_image"', "prerendered Twitter");
            assertContains(botRes.text, 'name="twitter:title"', "prerendered Twitter");
            assertContains(botRes.text, 'name="twitter:image"', "prerendered Twitter");
        }, onStart));

        results.push(await runTest("Bot prerender: story has lang attribute", async () => {
            assertMatches(botRes.text, /<html lang="[a-z]{2}">/, "prerendered HTML");
        }, onStart));

        // WhatsApp user-agent must trigger prerender
        const whatsappRes = await httpGet(`/story/${storySlug}`, {
            "User-Agent": "WhatsApp/2.0 (+http://www.whatsapp.com/)"
        });
        results.push(await runTest("Bot prerender: WhatsApp user-agent triggers prerender", async () => {
            assert(whatsappRes.status === 200, `Expected 200, got ${whatsappRes.status}`);
            assertContains(whatsappRes.text, 'property="og:image"', "WhatsApp prerender");
            assertContains(whatsappRes.text, 'property="og:title"', "WhatsApp prerender");
        }, onStart));

        // Google-InspectionTool is used by Google Search Console to verify how Google renders a page
        const gscRes = await httpGet(`/story/${storySlug}`, {
            "User-Agent": "Mozilla/5.0 (compatible; Google-InspectionTool/1.0)"
        });
        results.push(await runTest("Bot prerender: Google-InspectionTool (Search Console) triggers prerender", async () => {
            assert(gscRes.status === 200, `Expected 200, got ${gscRes.status}`);
            assertContains(gscRes.text, 'property="og:title"', "Google-InspectionTool prerender");
            assertContains(gscRes.text, 'property="og:image"', "Google-InspectionTool prerender");
            assertContains(gscRes.text, "| Quick Story</title>", "Google-InspectionTool prerender");
        }, onStart));

        // Non-bot should NOT get prerendered HTML
        const browserRes = await httpGet(`/story/${storySlug}`, {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        });
        results.push(await runTest("Regular browser does NOT get prerendered HTML", async () => {
            assertNotContains(browserRes.text, "| Quick Story</title>", "browser response");
        }, onStart));
    } else {
        results.push(await runTest("Bot prerender: story tests (SKIPPED — no stories in DB)", async () => {
            // pass — nothing to test
        }, onStart));
    }

    // Language-prefixed URL tests (e.g. /he/story/... or /en/story/...)
    if (langStoryPath) {
        const langBotRes = await httpGet(langStoryPath, {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
        });
        results.push(await runTest(`Bot prerender: language-prefixed URL works (${langStoryPath.substring(0, 35)}...)`, async () => {
            assert(langBotRes.status === 200, `Expected 200, got ${langBotRes.status}`);
            assertContains(langBotRes.text, 'property="og:image"', "lang-prefixed prerender");
            assertContains(langBotRes.text, 'property="og:title"', "lang-prefixed prerender");
        }, onStart));

        const langBrowserRes = await httpGet(langStoryPath, {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        });
        results.push(await runTest("Regular browser on language-prefixed URL gets SPA, not prerender", async () => {
            assertNotContains(langBrowserRes.text, "| Quick Story</title>", "browser response on lang URL");
        }, onStart));
    } else {
        results.push(await runTest("Bot prerender: language-prefixed URL tests (SKIPPED — no lang-prefixed stories in sitemap)", async () => {
            // pass — nothing to test
        }, onStart));
    }

    if (lessonSlug) {
        const botRes = await httpGet(`/lesson/${lessonSlug}`, {
            "User-Agent": "facebookexternalhit/1.1"
        });

        results.push(await runTest(`Bot prerender: lesson page returns HTML (${lessonSlug.substring(0, 30)}...)`, async () => {
            assert(botRes.status === 200, `Expected 200, got ${botRes.status}`);
            assertContains(botRes.text, "<!DOCTYPE html>", "prerendered HTML");
            assertContains(botRes.text, "| Quick Lesson</title>", "prerendered title");
        }, onStart));

        results.push(await runTest("Bot prerender: lesson has OG + Twitter tags", async () => {
            assertContains(botRes.text, 'property="og:type" content="article"', "prerendered OG");
            assertContains(botRes.text, 'name="twitter:card" content="summary_large_image"', "prerendered Twitter");
        }, onStart));
    } else {
        results.push(await runTest("Bot prerender: lesson tests (SKIPPED — no lessons in DB)", async () => {
            // pass — nothing to test
        }, onStart));
    }

    // Non-existent slug should not crash
    const missingRes = await httpGet("/story/this-slug-does-not-exist-999999", {
        "User-Agent": "Googlebot"
    });
    results.push(await runTest("Bot prerender: non-existent slug handled gracefully", async () => {
        assert(missingRes.status <= 404, `Expected <= 404, got ${missingRes.status}`);
    }, onStart));

    return results;
}

async function headersTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const res = await httpGet("/health");
    results.push(await runTest("X-Robots-Tag header is set to 'index, follow'", async () => {
        assert(res.headers["x-robots-tag"] === "index, follow",
            `Expected "index, follow", got "${res.headers["x-robots-tag"]}"`);
    }, onStart));

    return results;
}

// =============================================================================
// Directory pages (all-stories / all-lessons) bot prerender tests
// =============================================================================

async function directoryPageTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // --- /all-stories bot prerender ---
    const storiesBotRes = await httpGet("/all-stories", {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    });

    results.push(await runTest("All Stories directory: bot gets prerendered HTML", async () => {
        assert(storiesBotRes.status === 200, `Expected 200, got ${storiesBotRes.status}`);
        assertContains(storiesBotRes.text, "<!DOCTYPE html>", "prerendered HTML");
        assertContains(storiesBotRes.text, "All Fairy Tales", "prerendered title");
    }, onStart));

    results.push(await runTest("All Stories directory: has meta description", async () => {
        assertContains(storiesBotRes.text, '<meta name="description"', "meta description");
    }, onStart));

    results.push(await runTest("All Stories directory: has canonical URL", async () => {
        assertContains(storiesBotRes.text, '<link rel="canonical"', "canonical link");
    }, onStart));

    results.push(await runTest("All Stories directory: has hreflang links", async () => {
        assertContains(storiesBotRes.text, 'hreflang="en"', "hreflang en");
        assertContains(storiesBotRes.text, 'hreflang="he"', "hreflang he");
        assertContains(storiesBotRes.text, 'hreflang="x-default"', "hreflang x-default");
    }, onStart));

    results.push(await runTest("All Stories directory: has JSON-LD structured data", async () => {
        assertContains(storiesBotRes.text, 'application/ld+json', "JSON-LD script tag");
        assertContains(storiesBotRes.text, '"@type":"CollectionPage"', "CollectionPage type");
    }, onStart));

    results.push(await runTest("All Stories directory: has Open Graph tags", async () => {
        assertContains(storiesBotRes.text, 'property="og:title"', "og:title");
        assertContains(storiesBotRes.text, 'property="og:description"', "og:description");
    }, onStart));

    results.push(await runTest("All Stories directory: contains story links with /story/ prefix", async () => {
        // Only check if there are actual stories
        if (storiesBotRes.text.includes("<li>")) {
            assertMatches(storiesBotRes.text, /href="[^"]*\/story\/[^"]+"/,  "story links");
        }
    }, onStart));

    results.push(await runTest("All Stories directory: has alphabetical section headings", async () => {
        // Check for at least one letter heading (h2) if content exists
        if (storiesBotRes.text.includes("<li>")) {
            assertMatches(storiesBotRes.text, /<h2>[A-Z\u0590-\u05FF#]<\/h2>/, "letter headings");
        }
    }, onStart));

    // Non-bot should NOT get prerendered HTML
    const storiesBrowserRes = await httpGet("/all-stories", {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    });
    results.push(await runTest("All Stories directory: regular browser does NOT get prerendered HTML", async () => {
        assertNotContains(storiesBrowserRes.text, "All Fairy Tales & Stories", "browser response");
    }, onStart));

    // --- /all-lessons bot prerender ---
    const lessonsBotRes = await httpGet("/all-lessons", {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    });

    results.push(await runTest("All Lessons directory: bot gets prerendered HTML", async () => {
        assert(lessonsBotRes.status === 200, `Expected 200, got ${lessonsBotRes.status}`);
        assertContains(lessonsBotRes.text, "<!DOCTYPE html>", "prerendered HTML");
        assertContains(lessonsBotRes.text, "All Educational Lessons", "prerendered title");
    }, onStart));

    results.push(await runTest("All Lessons directory: has JSON-LD structured data", async () => {
        assertContains(lessonsBotRes.text, 'application/ld+json', "JSON-LD script tag");
        assertContains(lessonsBotRes.text, '"@type":"CollectionPage"', "CollectionPage type");
    }, onStart));

    results.push(await runTest("All Lessons directory: contains lesson links with /lesson/ prefix", async () => {
        if (lessonsBotRes.text.includes("<li>")) {
            assertMatches(lessonsBotRes.text, /href="[^"]*\/lesson\/[^"]+"/,  "lesson links");
        }
    }, onStart));

    // --- Language-prefixed directory pages ---
    const storiesHeBotRes = await httpGet("/he/all-stories", {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    });

    results.push(await runTest("All Stories directory (Hebrew): bot gets prerendered HTML", async () => {
        assert(storiesHeBotRes.status === 200, `Expected 200, got ${storiesHeBotRes.status}`);
        assertContains(storiesHeBotRes.text, '<!DOCTYPE html>', "prerendered HTML");
        assertContains(storiesHeBotRes.text, 'lang="he"', "Hebrew lang attribute");
    }, onStart));

    results.push(await runTest("All Stories directory (Hebrew): has RTL direction", async () => {
        assertContains(storiesHeBotRes.text, 'dir="rtl"', "RTL direction");
    }, onStart));

    // --- /sitemap/all-stories alias works ---
    const aliasRes = await httpGet("/sitemap/all-stories", {
        "User-Agent": "Googlebot"
    });
    results.push(await runTest("Sitemap alias /sitemap/all-stories: bot gets prerendered HTML", async () => {
        assert(aliasRes.status === 200, `Expected 200, got ${aliasRes.status}`);
        assertContains(aliasRes.text, "<!DOCTYPE html>", "prerendered HTML");
    }, onStart));

    return results;
}

// =============================================================================
// Tag/Category page bot prerender tests
// =============================================================================

async function tagPageTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Discover a real tag slug from the tags sitemap
    const tagsRes = await httpGet("/sitemap-tags-en.xml");
    const tagMatch = tagsRes.text.match(/\/cat\/([^<]+)</);
    const tagSlug = tagMatch ? tagMatch[1] : null;

    if (tagSlug) {
        const botRes = await httpGet(`/cat/${tagSlug}`, {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
        });

        results.push(await runTest(`Tag page bot prerender: returns HTML (/cat/${tagSlug.substring(0, 25)}...)`, async () => {
            assert(botRes.status === 200, `Expected 200, got ${botRes.status}`);
            assertContains(botRes.text, "<!DOCTYPE html>", "prerendered HTML");
            assertContains(botRes.text, "| Quick</title>", "prerendered title");
        }, onStart));

        results.push(await runTest("Tag page bot prerender: has OG meta tags", async () => {
            assertContains(botRes.text, 'property="og:title"', "og:title");
            assertContains(botRes.text, 'property="og:description"', "og:description");
        }, onStart));

        results.push(await runTest("Tag page bot prerender: has Twitter card tags", async () => {
            assertContains(botRes.text, 'name="twitter:card"', "twitter:card");
            assertContains(botRes.text, 'name="twitter:title"', "twitter:title");
        }, onStart));

        results.push(await runTest("Tag page bot prerender: has JSON-LD structured data", async () => {
            assertContains(botRes.text, 'application/ld+json', "JSON-LD script tag");
            assertContains(botRes.text, '"@type":"CollectionPage"', "CollectionPage type");
        }, onStart));

        results.push(await runTest("Tag page bot prerender: has canonical URL", async () => {
            assertContains(botRes.text, '<link rel="canonical"', "canonical link");
        }, onStart));

        results.push(await runTest("Tag page bot prerender: has hreflang links", async () => {
            assertContains(botRes.text, 'hreflang="en"', "hreflang en");
            assertContains(botRes.text, 'hreflang="he"', "hreflang he");
        }, onStart));

        results.push(await runTest("Tag page bot prerender: contains crawlable content links", async () => {
            // If there are stories/lessons, they should be rendered as links
            if (botRes.text.includes("<li>")) {
                assertMatches(botRes.text, /href="[^"]*\/(story|lesson)\/[^"]+"/,  "content links");
            }
        }, onStart));

        // Language-prefixed tag page
        const langBotRes = await httpGet(`/en/cat/${tagSlug}`, {
            "User-Agent": "Googlebot"
        });
        results.push(await runTest("Tag page bot prerender: language-prefixed URL works", async () => {
            assert(langBotRes.status === 200, `Expected 200, got ${langBotRes.status}`);
            assertContains(langBotRes.text, "<!DOCTYPE html>", "prerendered HTML");
            assertContains(langBotRes.text, 'lang="en"', "lang attribute");
        }, onStart));

        // Non-bot should NOT get prerendered HTML
        const browserRes = await httpGet(`/cat/${tagSlug}`, {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        });
        results.push(await runTest("Tag page: regular browser does NOT get prerendered HTML", async () => {
            assertNotContains(browserRes.text, "| Quick</title>", "browser response");
        }, onStart));
    } else {
        results.push(await runTest("Tag page bot prerender tests (SKIPPED — no tags in DB)", async () => {
            // pass — nothing to test
        }, onStart));
    }

    // Non-existent tag should not crash
    const missingRes = await httpGet("/cat/this-tag-does-not-exist-999999", {
        "User-Agent": "Googlebot"
    });
    results.push(await runTest("Tag page bot prerender: non-existent tag handled gracefully", async () => {
        assert(missingRes.status <= 404, `Expected <= 404, got ${missingRes.status}`);
    }, onStart));

    // /tag/ alias should also work
    if (tagSlug) {
        const aliasRes = await httpGet(`/tag/${tagSlug}`, {
            "User-Agent": "Googlebot"
        });
        results.push(await runTest("Tag page bot prerender: /tag/ alias also works", async () => {
            assert(aliasRes.status === 200, `Expected 200, got ${aliasRes.status}`);
            assertContains(aliasRes.text, "<!DOCTYPE html>", "prerendered HTML");
        }, onStart));
    }

    return results;
}

// =============================================================================
// Export the category
// =============================================================================

export const seoTestCategory: TestCategory = {
    name: "SEO",
    description: "Sitemaps, robots.txt, bot pre-rendering, tag pages, directory pages, and HTTP headers",
    testCount: 60,
    run: async (onResult, onStart) => {
        const results: TestResult[] = [];
        const emit = (r: TestResult) => { results.push(r); onResult?.(r); };

        for (const r of await robotsTxtTests(onStart)) emit(r);
        for (const r of await sitemapIndexTests(onStart)) emit(r);
        for (const r of await staticSitemapTests(onStart)) emit(r);
        for (const r of await contentSitemapTests(onStart)) emit(r);
        for (const r of await botPrerenderTests(onStart)) emit(r);
        for (const r of await tagPageTests(onStart)) emit(r);
        for (const r of await directoryPageTests(onStart)) emit(r);
        for (const r of await headersTests(onStart)) emit(r);
        return results;
    }
};
