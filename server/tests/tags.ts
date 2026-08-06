/**
 * Tags Test Category
 * Tests tag API endpoints, slug integrity for non-Latin languages (Hebrew, etc.),
 * language-filtered tag discovery, and tag page rendering.
 */

import { TestCategory, TestResult } from "./types";
import { testFetch } from "./self_request";
import { unrunResults } from "./result";

// NOTE: requests go through testFetch() — on Workers a self-fetch over the network
// returns an instant 522, so it dispatches in-isolate instead. See ./self_request.

async function httpGet(path: string, headers: Record<string, string> = {}): Promise<{
    status: number;
    text: string;
    json: any;
    headers: Record<string, string>;
}> {
    const res = await testFetch(path, { headers });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { responseHeaders[k] = v; });
    return { status: res.status, text, json, headers: responseHeaders };
}

async function apiGet(path: string): Promise<{ status: number; json: any }> {
    const res = await testFetch(`/api${path}`);
    let json: any = null;
    try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, json };
}

async function runTest(name: string, fn: () => Promise<void>, details?: any, onStart?: (name: string) => void): Promise<TestResult> {
    onStart?.(name);
    const start = Date.now();
    try {
        await fn();
        return { name, passed: true, message: "Passed", durationMs: Date.now() - start, ...(details !== undefined && { details }) };
    } catch (err: any) {
        return { name, passed: false, message: err.message || String(err), durationMs: Date.now() - start, ...(details !== undefined && { details }) };
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function assertNonEmpty(value: any, label: string) {
    if (!value || (typeof value === "string" && value.trim() === "")) {
        throw new Error(`${label} should be non-empty but got: ${JSON.stringify(value)}`);
    }
}

// Test names are declared statically so a block whose fixture is missing still
// emits one result per test. Details that vary per run (slugs, counts) live in the
// assertion messages, not the names, so the rows stay stable.
const TAG_STRUCTURE_TESTS = [
    "Every tag has name and slug fields",
    "No tag has an empty slug",
] as const;

const NON_ASCII_TAG_TESTS = [
    "Non-ASCII tags all have non-empty slugs",
    "Non-ASCII tag slugs don't contain only dashes or whitespace",
] as const;

const HEBREW_FILTER_TESTS = [
    "Hebrew-filtered tags all have non-empty slugs",
] as const;

const ENGLISH_LOOKUP_TESTS = [
    "GET /discovery/tags/s/:slug returns 200",
    "Tag lookup returns creations with tags field",
] as const;

const NON_ASCII_LOOKUP_TESTS = [
    "Non-ASCII tag lookup by slug returns 200",
    "Non-ASCII tag lookup by name fallback returns 200",
] as const;

const LANG_FILTERED_LOOKUP_TESTS = [
    "Tag lookup with lang=en filter returns 200",
] as const;

const HEBREW_TAG_PAGE_TESTS = [
    "Hebrew tag page: bot gets HTML",
    "Hebrew tag page: has Hebrew lang attribute",
    "Hebrew tag page: has RTL direction",
    "Hebrew tag page: has OG meta tags",
    "Hebrew tag via /cat/ (no lang prefix): returns HTML",
] as const;

const CROSS_LANGUAGE_TAG_PAGE_TESTS = [
    "/he/cat/ with English tag slug: returns 200",
    "/he/cat/ with English tag slug: has Hebrew lang attribute",
    "/en/cat/ tag page: has English lang attribute",
] as const;

const NON_ASCII_SLUG_INTEGRITY_TESTS = [
    "Non-ASCII tag names produce slugs that contain at least one non-ASCII or digit char",
] as const;

const SITEMAP_TAG_LANG_TESTS = [
    "Every tag in /sitemap-tags-en.xml has English content",
    "Every tag in /sitemap-tags-he.xml has Hebrew content",
    "Tags sitemaps don't cross-list single-language tags",
] as const;

const CONTENT_LANG_PREFIX_TESTS = [
    "Hebrew story under /en/ resolves to the Hebrew page",
    "Hebrew story page canonical points at the /he/ prefix",
    "Hebrew story under its own /he/ prefix is served directly",
] as const;

const TAG_LINK_RESOLVES_TESTS = [
    "Every tag on a Hebrew story resolves to a non-empty Hebrew tag page",
] as const;

// =============================================================================
// Tag list API tests
// =============================================================================

async function tagListApiTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const { status, json } = await apiGet("/discovery/tags");

    results.push(await runTest("GET /discovery/tags returns 200", async () => {
        assert(status === 200, `Expected 200, got ${status}`);
    }, json, onStart));

    results.push(await runTest("GET /discovery/tags returns an array", async () => {
        assert(Array.isArray(json), `Expected array, got ${typeof json}`);
    }, onStart));

    if (Array.isArray(json) && json.length > 0) {
        results.push(await runTest(TAG_STRUCTURE_TESTS[0], async () => {
            for (const tag of json) {
                assert(typeof tag.name === "string", `Tag missing name: ${JSON.stringify(tag)}`);
                assert(typeof tag.slug === "string", `Tag missing slug: ${JSON.stringify(tag)}`);
                assert(typeof tag.count === "number", `Tag missing count: ${JSON.stringify(tag)}`);
            }
        }, onStart));

        results.push(await runTest(TAG_STRUCTURE_TESTS[1], async () => {
            const broken = json.filter((t: any) => !t.slug || t.slug.trim() === "");
            assert(broken.length === 0,
                `Found ${broken.length} tag(s) with empty slugs: ${broken.map((t: any) => t.name).join(", ")}`);
        }, json, onStart));

        // Check Hebrew tags specifically (non-ASCII names)
        const hebrewTags = json.filter((t: any) => /[^\x00-\x7F]/.test(t.name));
        if (hebrewTags.length > 0) {
            results.push(await runTest(NON_ASCII_TAG_TESTS[0], async () => {
                for (const tag of hebrewTags) {
                    assertNonEmpty(tag.slug, `Slug for tag "${tag.name}"`);
                }
            }, hebrewTags, onStart));

            results.push(await runTest(NON_ASCII_TAG_TESTS[1], async () => {
                for (const tag of hebrewTags) {
                    const normalized = tag.slug.replace(/-/g, "").trim();
                    assert(normalized.length > 0,
                        `Tag "${tag.name}" has a slug that collapses to nothing after removing dashes: "${tag.slug}"`);
                }
            }, onStart));
        } else {
            results.push(...unrunResults(NON_ASCII_TAG_TESTS, true,
                "no non-ASCII tags in the DB", ""));
        }
    } else {
        results.push(...unrunResults(TAG_STRUCTURE_TESTS, status === 200,
            "no tags in the DB",
            `GET /api/discovery/tags returned ${status}`));
        results.push(...unrunResults(NON_ASCII_TAG_TESTS, status === 200,
            "no tags in the DB",
            `GET /api/discovery/tags returned ${status}`));
    }

    return results;
}

// =============================================================================
// Tag-language filter tests
// =============================================================================

async function tagLanguageFilterTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const { status: enStatus, json: enTags } = await apiGet("/discovery/tags?lang=en");
    results.push(await runTest("GET /discovery/tags?lang=en returns 200", async () => {
        assert(enStatus === 200, `Expected 200, got ${enStatus}`);
        assert(Array.isArray(enTags), "Expected array");
    }, onStart));

    const { status: heStatus, json: heTags } = await apiGet("/discovery/tags?lang=he");
    results.push(await runTest("GET /discovery/tags?lang=he returns 200", async () => {
        assert(heStatus === 200, `Expected 200, got ${heStatus}`);
        assert(Array.isArray(heTags), "Expected array");
    }, onStart));

    results.push(await runTest("Hebrew tags endpoint returns an array (may be empty)", async () => {
        assert(Array.isArray(heTags), `Expected array, got ${typeof heTags}`);
    }, heTags, onStart));

    if (Array.isArray(heTags) && heTags.length > 0) {
        results.push(await runTest(HEBREW_FILTER_TESTS[0], async () => {
            const broken = heTags.filter((t: any) => !t.slug || t.slug.trim() === "");
            assert(broken.length === 0,
                `Found ${broken.length} Hebrew tag(s) with empty slugs: ${broken.map((t: any) => t.name).join(", ")}`);
        }, heTags, onStart));
    } else {
        // Previously emitted nothing at all — the test simply vanished from the run.
        results.push(...unrunResults(HEBREW_FILTER_TESTS, heStatus === 200,
            "no Hebrew-filtered tags in the DB",
            `GET /api/discovery/tags?lang=he returned ${heStatus}`));
    }

    return results;
}

// =============================================================================
// Tag slug lookup API tests
// =============================================================================

async function tagSlugLookupTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Fetch all tags to get a real slug to test against
    const { status: allTagsStatus, json: allTags } = await apiGet("/discovery/tags");
    const tagsOk = allTagsStatus === 200;
    const tags: any[] = Array.isArray(allTags) ? allTags : [];
    const englishTag = tags.find((t: any) => /^[\x00-\x7F]+$/.test(t.name) && t.slug && t.count > 0);
    const nonAsciiTag = tags.find((t: any) => /[^\x00-\x7F]/.test(t.name) && t.slug && t.count > 0);

    if (englishTag) {
        const { status, json } = await apiGet(`/discovery/tags/s/${encodeURIComponent(englishTag.slug)}`);
        results.push(await runTest(ENGLISH_LOOKUP_TESTS[0], async () => {
            assert(status === 200, `Expected 200, got ${status}`);
            assert(Array.isArray(json), `Expected array of creations, got ${typeof json}`);
        }, json, onStart));

        results.push(await runTest(ENGLISH_LOOKUP_TESTS[1], async () => {
            if (Array.isArray(json) && json.length > 0) {
                const creation = json[0];
                assert(Array.isArray(creation.tags), `Expected tags array on creation, got ${typeof creation.tags}`);
            }
        }, onStart));
    } else {
        results.push(...unrunResults(ENGLISH_LOOKUP_TESTS, tagsOk,
            "no English tags with content in the DB",
            `GET /api/discovery/tags returned ${allTagsStatus}`));
    }

    if (nonAsciiTag) {
        const encoded = encodeURIComponent(nonAsciiTag.slug);
        const { status, json } = await apiGet(`/discovery/tags/s/${encoded}`);
        results.push(await runTest(NON_ASCII_LOOKUP_TESTS[0], async () => {
            assert(status === 200, `Expected 200, got ${status}. Tag: ${JSON.stringify(nonAsciiTag)}`);
            assert(Array.isArray(json), `Expected array, got ${typeof json}`);
        }, json, onStart));

        // Also test name-based fallback: looking up by tag name should also work
        const nameEncoded = encodeURIComponent(nonAsciiTag.name);
        const { status: nameStatus, json: nameJson } = await apiGet(`/discovery/tags/s/${nameEncoded}`);
        results.push(await runTest(NON_ASCII_LOOKUP_TESTS[1], async () => {
            assert(nameStatus === 200, `Expected 200 for name lookup, got ${nameStatus}`);
            assert(Array.isArray(nameJson), `Expected array, got ${typeof nameJson}`);
        }, nameJson, onStart));
    } else {
        results.push(...unrunResults(NON_ASCII_LOOKUP_TESTS, tagsOk,
            "no non-ASCII tags with content in the DB",
            `GET /api/discovery/tags returned ${allTagsStatus}`));
    }

    // Non-existent slug must return 404
    const { status: missingStatus } = await apiGet("/discovery/tags/s/this-tag-does-not-exist-999abc");
    results.push(await runTest("Non-existent tag slug returns 404", async () => {
        assert(missingStatus === 404, `Expected 404, got ${missingStatus}`);
    }, onStart));

    // Language-filtered tag lookup
    if (englishTag) {
        const { status, json } = await apiGet(`/discovery/tags/s/${encodeURIComponent(englishTag.slug)}?lang=en`);
        results.push(await runTest(LANG_FILTERED_LOOKUP_TESTS[0], async () => {
            assert(status === 200, `Expected 200, got ${status}`);
            assert(Array.isArray(json), "Expected array");
        }, onStart));
    } else {
        results.push(...unrunResults(LANG_FILTERED_LOOKUP_TESTS, tagsOk,
            "no English tags with content in the DB",
            `GET /api/discovery/tags returned ${allTagsStatus}`));
    }

    return results;
}

// =============================================================================
// Tag page prerender tests in multiple languages
// =============================================================================

async function tagPageLanguageTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const botUA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

    // Discover a Hebrew tag from the Hebrew sitemap
    const heTagsSitemap = await httpGet("/sitemap-tags-he.xml");
    const heTagMatch = heTagsSitemap.text.match(/\/cat\/([^<]+)</);
    const heTagSlug = heTagMatch ? decodeURIComponent(heTagMatch[1]) : null;

    // Also look for a Hebrew tag from the tags API
    const { json: allTags } = await apiGet("/discovery/tags?lang=he");
    const heApiTag = Array.isArray(allTags) && allTags.length > 0
        ? allTags.find((t: any) => t.slug && t.slug.trim() !== "") || null
        : null;

    const workingHeTag = heTagSlug || heApiTag?.slug || null;

    if (workingHeTag) {
        // Hebrew tag page via /he/cat/:slug
        const hePageRes = await httpGet(`/he/cat/${encodeURIComponent(workingHeTag)}`, { "User-Agent": botUA });
        results.push(await runTest(HEBREW_TAG_PAGE_TESTS[0], async () => {
            assert(hePageRes.status === 200, `Expected 200 for /he/cat/${workingHeTag}, got ${hePageRes.status}`);
            assert(hePageRes.text.includes("<!DOCTYPE html>"), "Expected prerendered HTML");
        }, onStart));

        results.push(await runTest(HEBREW_TAG_PAGE_TESTS[1], async () => {
            assert(hePageRes.text.includes('lang="he"'), `Expected lang="he" in HTML`);
        }, onStart));

        results.push(await runTest(HEBREW_TAG_PAGE_TESTS[2], async () => {
            assert(hePageRes.text.includes('dir="rtl"'), `Expected dir="rtl" in HTML`);
        }, onStart));

        results.push(await runTest(HEBREW_TAG_PAGE_TESTS[3], async () => {
            assert(hePageRes.text.includes('property="og:title"'), "Missing og:title");
            assert(hePageRes.text.includes('property="og:description"'), "Missing og:description");
        }, onStart));

        // Same tag at the non-prefixed /cat/ path
        const defaultPageRes = await httpGet(`/cat/${encodeURIComponent(workingHeTag)}`, { "User-Agent": botUA });
        results.push(await runTest(HEBREW_TAG_PAGE_TESTS[4], async () => {
            assert(defaultPageRes.status === 200, `Expected 200, got ${defaultPageRes.status}`);
            assert(defaultPageRes.text.includes("<!DOCTYPE html>"), "Expected prerendered HTML");
        }, onStart));
    } else {
        results.push(...unrunResults(HEBREW_TAG_PAGE_TESTS, heTagsSitemap.status === 200,
            "no Hebrew tags with content",
            `/sitemap-tags-he.xml returned ${heTagsSitemap.status}`));
    }

    // Discover an English tag
    const enTagsSitemap = await httpGet("/sitemap-tags-en.xml");
    const enTagMatch = enTagsSitemap.text.match(/\/cat\/([^<]+)</);
    const enTagSlug = enTagMatch ? enTagMatch[1] : null;

    if (enTagSlug) {
        // /he/cat/<english-tag> should still return 200 (Hebrew UI, English tag)
        const heMixedRes = await httpGet(`/he/cat/${enTagSlug}`, { "User-Agent": botUA });
        results.push(await runTest(CROSS_LANGUAGE_TAG_PAGE_TESTS[0], async () => {
            assert(heMixedRes.status === 200, `Expected 200, got ${heMixedRes.status}`);
            assert(heMixedRes.text.includes("<!DOCTYPE html>"), "Expected prerendered HTML");
        }, onStart));

        results.push(await runTest(CROSS_LANGUAGE_TAG_PAGE_TESTS[1], async () => {
            assert(heMixedRes.text.includes('lang="he"'), `Expected lang="he"`);
        }, onStart));

        // /en/cat/<slug> should use English lang
        const enPageRes = await httpGet(`/en/cat/${enTagSlug}`, { "User-Agent": botUA });
        results.push(await runTest(CROSS_LANGUAGE_TAG_PAGE_TESTS[2], async () => {
            assert(enPageRes.status === 200, `Expected 200, got ${enPageRes.status}`);
            assert(enPageRes.text.includes('lang="en"'), `Expected lang="en"`);
        }, onStart));
    } else {
        results.push(...unrunResults(CROSS_LANGUAGE_TAG_PAGE_TESTS, enTagsSitemap.status === 200,
            "no English tags in /sitemap-tags-en.xml",
            `/sitemap-tags-en.xml returned ${enTagsSitemap.status}`));
    }

    return results;
}

// =============================================================================
// Slug integrity tests (checks that the slugify logic is correct)
// =============================================================================

async function slugIntegrityTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const { status: allTagsStatus, json: allTags } = await apiGet("/discovery/tags");
    const tags: any[] = Array.isArray(allTags) ? allTags : [];

    results.push(await runTest("All tags in DB have non-empty slugs", async () => {
        const broken = tags.filter((t: any) => !t.slug || t.slug.trim() === "");
        assert(broken.length === 0,
            `${broken.length} tag(s) still have empty slugs: ${broken.map((t: any) => JSON.stringify(t.name)).join(", ")}`);
    }, tags.filter((t: any) => !t.slug || t.slug.trim() === ""), onStart));

    results.push(await runTest("No tag slug is just a hyphen or underscores", async () => {
        const suspicious = tags.filter((t: any) => t.slug && /^[-_]+$/.test(t.slug));
        assert(suspicious.length === 0,
            `Tags with degenerate slugs: ${suspicious.map((t: any) => `"${t.name}" -> "${t.slug}"`).join(", ")}`);
    }, onStart));

    const nonAsciiTags = tags.filter((t: any) => /[^\x00-\x7F]/.test(t.name));
    if (nonAsciiTags.length > 0) {
        results.push(await runTest(NON_ASCII_SLUG_INTEGRITY_TESTS[0], async () => {
            for (const tag of nonAsciiTags) {
                const slug = tag.slug || "";
                const hasContent = /[^\x00-\x7F\-_]/.test(slug); // has a non-ASCII or non-hyphen character
                assert(hasContent,
                    `Tag "${tag.name}" has slug "${slug}" which looks like it lost all Unicode chars`);
            }
        }, nonAsciiTags, onStart));
    } else {
        results.push(...unrunResults(NON_ASCII_SLUG_INTEGRITY_TESTS, allTagsStatus === 200,
            "no non-ASCII tags in the DB",
            `GET /api/discovery/tags returned ${allTagsStatus}`));
    }

    return results;
}

// =============================================================================
// Sitemap / tag-page language consistency
//
// Regression guard for the bug where /en/cat/<hebrew-slug> rendered empty: the
// tags sitemap listed EVERY tag under EVERY language prefix, while both the tag
// API and the bot prerender filter tagged content by language. Any tag listed
// for a language it has no content in is a guaranteed-empty page submitted to
// Google. The invariant: a tag appears in sitemap-tags-<lang>.xml only if the
// tag API returns at least one creation for that same lang.
// =============================================================================

/** Pull the decoded tag slugs out of a sitemap-tags-<lang>.xml body. */
function tagSlugsFromSitemap(xml: string): string[] {
    const slugs: string[] = [];
    const locRe = /<loc>[^<]*?\/cat\/([^<]+)<\/loc>/g;
    let m: RegExpExecArray | null;
    while ((m = locRe.exec(xml)) !== null) {
        try { slugs.push(decodeURIComponent(m[1])); } catch { slugs.push(m[1]); }
    }
    return slugs;
}

async function sitemapTagLanguageTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const enSitemap = await httpGet("/sitemap-tags-en.xml");
    const heSitemap = await httpGet("/sitemap-tags-he.xml");
    const sitemapsOk = enSitemap.status === 200 && heSitemap.status === 200;

    if (!sitemapsOk) {
        return unrunResults(SITEMAP_TAG_LANG_TESTS, false,
            "tags sitemaps unavailable",
            `/sitemap-tags-en.xml returned ${enSitemap.status}, /sitemap-tags-he.xml returned ${heSitemap.status}`);
    }

    const enSlugs = tagSlugsFromSitemap(enSitemap.text);
    const heSlugs = tagSlugsFromSitemap(heSitemap.text);

    // Cap the per-slug API checks so a large tag table doesn't make the suite crawl.
    const SAMPLE = 25;

    async function emptyFor(slugs: string[], lang: string): Promise<string[]> {
        const empty: string[] = [];
        for (const slug of slugs.slice(0, SAMPLE)) {
            const { json } = await apiGet(`/discovery/tags/s/${encodeURIComponent(slug)}?lang=${lang}`);
            if (!Array.isArray(json) || json.length === 0) empty.push(slug);
        }
        return empty;
    }

    const enEmpty = await emptyFor(enSlugs, "en");
    results.push(await runTest(SITEMAP_TAG_LANG_TESTS[0], async () => {
        assert(enEmpty.length === 0,
            `${enEmpty.length} of ${Math.min(enSlugs.length, SAMPLE)} sampled tags in /sitemap-tags-en.xml return no English content: ${enEmpty.slice(0, 5).join(", ")}`);
    }, enEmpty, onStart));

    const heEmpty = await emptyFor(heSlugs, "he");
    results.push(await runTest(SITEMAP_TAG_LANG_TESTS[1], async () => {
        assert(heEmpty.length === 0,
            `${heEmpty.length} of ${Math.min(heSlugs.length, SAMPLE)} sampled tags in /sitemap-tags-he.xml return no Hebrew content: ${heEmpty.slice(0, 5).join(", ")}`);
    }, heEmpty, onStart));

    // A tag listed in both sitemaps must genuinely exist in both languages.
    const inBoth = enSlugs.filter(slug => heSlugs.includes(slug)).slice(0, SAMPLE);
    const crossListed: string[] = [];
    for (const slug of inBoth) {
        const { json: enJson } = await apiGet(`/discovery/tags/s/${encodeURIComponent(slug)}?lang=en`);
        const { json: heJson } = await apiGet(`/discovery/tags/s/${encodeURIComponent(slug)}?lang=he`);
        const enHas = Array.isArray(enJson) && enJson.length > 0;
        const heHas = Array.isArray(heJson) && heJson.length > 0;
        if (!enHas || !heHas) crossListed.push(`${slug} (en=${enHas}, he=${heHas})`);
    }
    results.push(await runTest(SITEMAP_TAG_LANG_TESTS[2], async () => {
        assert(crossListed.length === 0,
            `Tags listed in both sitemaps but missing content in one: ${crossListed.slice(0, 5).join("; ")}`);
    }, crossListed, onStart));

    return results;
}

// =============================================================================
// Content language ↔ URL prefix
//
// A creation must only ever be served under the prefix matching its own
// language. When a Hebrew story was reachable at /en/story/<slug>, every link
// built with localizedPath() on that page inherited /en — including its tag
// chips, which is how /en/cat/<hebrew-slug> came to exist at all.
// NOTE: testFetch() follows redirects, so these assert the *destination*
// (canonical + lang attribute) rather than the 301 itself.
// =============================================================================

async function contentLangPrefixTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const botUA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

    // Find a Hebrew story slug from the Hebrew stories sitemap.
    const heStories = await httpGet("/sitemap-stories-he.xml");
    const slugMatch = heStories.text.match(/<loc>[^<]*?\/story\/([^<]+)<\/loc>/);
    const heSlug = slugMatch ? slugMatch[1] : null;

    if (!heSlug) {
        return unrunResults(CONTENT_LANG_PREFIX_TESTS, heStories.status === 200,
            "no Hebrew stories in /sitemap-stories-he.xml",
            `/sitemap-stories-he.xml returned ${heStories.status}`);
    }

    const wrongPrefix = await httpGet(`/en/story/${heSlug}`, { "User-Agent": botUA });

    results.push(await runTest(CONTENT_LANG_PREFIX_TESTS[0], async () => {
        assert(wrongPrefix.status === 200, `Expected 200 after redirect, got ${wrongPrefix.status}`);
        assert(wrongPrefix.text.includes('lang="he"'),
            `/en/story/${heSlug} should end up on the Hebrew page, but the HTML has no lang="he"`);
    }, onStart));

    results.push(await runTest(CONTENT_LANG_PREFIX_TESTS[1], async () => {
        const canonical = wrongPrefix.text.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || "";
        assertNonEmpty(canonical, "canonical link");
        assert(canonical.includes(`/he/story/${heSlug}`),
            `Canonical should point at the /he/ prefix but was "${canonical}"`);
        assert(!canonical.includes("/en/story/"),
            `Hebrew story must not self-canonicalize under /en/: "${canonical}"`);
    }, onStart));

    const rightPrefix = await httpGet(`/he/story/${heSlug}`, { "User-Agent": botUA });
    results.push(await runTest(CONTENT_LANG_PREFIX_TESTS[2], async () => {
        assert(rightPrefix.status === 200, `Expected 200, got ${rightPrefix.status}`);
        assert(rightPrefix.text.includes('lang="he"'), `Expected lang="he"`);
    }, onStart));

    return results;
}

// =============================================================================
// The original report: a Hebrew story's tag chips led to empty pages.
// Every tag on a Hebrew story must resolve to a tag page with content.
// =============================================================================

async function tagLinksResolveTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const heStories = await httpGet("/sitemap-stories-he.xml");
    const slugMatch = heStories.text.match(/<loc>[^<]*?\/story\/([^<]+)<\/loc>/);
    const heSlug = slugMatch ? slugMatch[1] : null;

    if (!heSlug) {
        return unrunResults(TAG_LINK_RESOLVES_TESTS, heStories.status === 200,
            "no Hebrew stories in /sitemap-stories-he.xml",
            `/sitemap-stories-he.xml returned ${heStories.status}`);
    }

    const { status: storyStatus, json: story } = await apiGet(`/stories/${heSlug}`);
    const tags: any[] = Array.isArray(story?.tags) ? story.tags : [];

    if (storyStatus !== 200 || tags.length === 0) {
        return unrunResults(TAG_LINK_RESOLVES_TESTS, storyStatus === 200,
            `Hebrew story ${heSlug} has no tags`,
            `GET /api/stories/${heSlug} returned ${storyStatus}`);
    }

    const broken: string[] = [];
    for (const tag of tags) {
        const slug = typeof tag === "string" ? tag : tag.slug;
        if (!slug) { broken.push(`<empty slug for "${typeof tag === "string" ? tag : tag.name}">`); continue; }
        const { json } = await apiGet(`/discovery/tags/s/${encodeURIComponent(slug)}?lang=he`);
        if (!Array.isArray(json) || json.length === 0) broken.push(slug);
    }

    return [await runTest(TAG_LINK_RESOLVES_TESTS[0], async () => {
        assert(broken.length === 0,
            `${broken.length}/${tags.length} tags on Hebrew story "${heSlug}" lead to an empty tag page: ${broken.join(", ")}`);
    }, { storySlug: heSlug, tags, broken }, onStart)];
}

// =============================================================================
// Export the category
// =============================================================================

export const tagsTestCategory: TestCategory = {
    name: "Tags",
    description: "Tag API endpoints, Hebrew/non-ASCII slug integrity, language-filtered discovery, and multilingual tag page rendering",
    run: async (onResult, onStart) => {
        const results: TestResult[] = [];
        const emit = (r: TestResult) => { results.push(r); onResult?.(r); };

        for (const r of await tagListApiTests(onStart)) emit(r);
        for (const r of await tagLanguageFilterTests(onStart)) emit(r);
        for (const r of await tagSlugLookupTests(onStart)) emit(r);
        for (const r of await slugIntegrityTests(onStart)) emit(r);
        for (const r of await tagPageLanguageTests(onStart)) emit(r);
        for (const r of await sitemapTagLanguageTests(onStart)) emit(r);
        for (const r of await contentLangPrefixTests(onStart)) emit(r);
        for (const r of await tagLinksResolveTests(onStart)) emit(r);
        return results;
    }
};
