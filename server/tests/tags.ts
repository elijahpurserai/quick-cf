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
        return results;
    }
};
