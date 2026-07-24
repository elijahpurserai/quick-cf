/**
 * Private Creation Test Category
 * Tests that private stories/lessons are correctly gated and excluded from Discovery.
 * Runs against the live server — generates a real story via OpenAI and verifies
 * access control and discovery exclusion end-to-end.
 */

import jwt from "jsonwebtoken";
import { TestCategory, TestResult } from "./types";
import { supabase } from "../supabase";

const SERVER_PORT = process.env.PORT || 3001;
const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${SERVER_PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

async function httpGet(path: string, cookie?: string): Promise<{ status: number; body: any }> {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: cookie ? { Cookie: cookie } : {},
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
}

async function httpPost(path: string, payload: any, cookie?: string): Promise<{ status: number; body: any }> {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
}

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
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

const BASE_STORY_PAYLOAD = {
    purpose: "adventure",
    childName: "Test Child",
    gender: "unspecified",
    age: 6,
    siblingNames: [],
    parentNames: [],
    pets: [],
    duration: 7,
    language: "en",
};

// =============================================================================
// Test suite
// =============================================================================

async function accessControlTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // 1. Anonymous request to a non-existent slug → 404 (no crash)
    results.push(await runTest("Access control: unknown slug returns 404 (not 500)", async () => {
        const { status } = await httpGet("/api/stories/s/nonexistent-private-slug-xyz");
        assert(status === 404, `Expected 404, got ${status}`);
    }, undefined, onStart));

    // 2. Discovery endpoint returns only public creations
    results.push(await runTest("Discovery: /api/discovery/public responds successfully", async () => {
        const { status, body } = await httpGet("/api/discovery/public");
        assert(status === 200, `Expected 200, got ${status}`);
        assert(Array.isArray(body), `Expected array response, got ${typeof body}`);
    }, undefined, onStart));

    return results;
}

async function privateStoryRoundTripTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const emit = (r: TestResult) => { results.push(r); };

    // Create a real Supabase auth user so the FK constraint on owner_id is satisfied
    const TEST_EMAIL = `test-private-${Date.now()}@quickstory-test.ai`;
    let testUserId: string | null = null;

    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
        email: TEST_EMAIL,
        email_confirm: true,
        user_metadata: { full_name: "Test Private User" },
    });

    if (createError || !authData?.user) {
        emit({ name: "Private story: remaining tests skipped (generation failed)", passed: false, message: `Could not create test user: ${createError?.message ?? "unknown error"}`, durationMs: 0 });
        return results;
    }

    testUserId = authData.user.id;
    const AUTH_COOKIE = `token=${jwt.sign({ id: testUserId, email: TEST_EMAIL }, JWT_SECRET)}`;
    const cleanup = () => supabase.auth.admin.deleteUser(testUserId!);

    let slug: string | null = null;
    let storyId: string | null = null;

    // Step 1: Generate a private story
    const genResult = await runTest("Private story: generation returns 200 with valid response", async () => {
        const { status, body } = await httpPost(
            "/api/generate-story",
            { ...BASE_STORY_PAYLOAD, visibility: "private" },
            AUTH_COOKIE
        );
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        assert(typeof body.slug === "string" && body.slug.length > 0, "Response missing slug");
        assert(typeof body.id === "string", "Response missing id");
        slug = body.slug;
        storyId = body.id;
    }, null, onStart);
    emit(genResult);

    if (!slug) {
        await cleanup();
        emit({ name: "Private story: remaining tests skipped (generation failed)", passed: false, message: "Story generation failed — cannot run downstream tests", durationMs: 0 });
        return results;
    }

    // Step 2: Anonymous access → 403
    emit(await runTest("Private story: anonymous access returns 403", async () => {
        const { status, body } = await httpGet(`/api/stories/s/${slug}`);
        assert(status === 403, `Expected 403 for anonymous access, got ${status}: ${JSON.stringify(body)}`);
    }, undefined, onStart));

    // Step 3: Different user's access → 403
    const otherToken = jwt.sign({ id: "00000000-0000-0000-0000-000000000099", email: "other@quickstory.ai" }, JWT_SECRET);
    emit(await runTest("Private story: different user access returns 403", async () => {
        const { status } = await httpGet(`/api/stories/s/${slug}`, `token=${otherToken}`);
        assert(status === 403, `Expected 403 for different user, got ${status}`);
    }, undefined, onStart));

    // Step 4: Owner access → 200
    emit(await runTest("Private story: owner access returns 200", async () => {
        const { status, body } = await httpGet(`/api/stories/s/${slug}`, AUTH_COOKIE);
        assert(status === 200, `Expected 200 for owner, got ${status}: ${JSON.stringify(body)}`);
        assert(body.slug === slug, `Expected slug ${slug}, got ${body.slug}`);
    }, undefined, onStart));

    // Step 5: Not in Discovery
    emit(await runTest("Private story: excluded from /api/discovery/public", async () => {
        const { status, body } = await httpGet("/api/discovery/public?limit=100");
        assert(status === 200, `Discovery endpoint returned ${status}`);
        assert(Array.isArray(body), "Discovery response is not an array");
        const found = body.some((item: any) => item.id === storyId || item.slug === slug);
        assert(!found, `Private story (slug: ${slug}) should not appear in Discovery but it does`);
    }, undefined, onStart));

    // Clean up test user (cascades to their creations)
    await cleanup();

    return results;
}

// =============================================================================
// Export
// =============================================================================

export const privateCreationTestCategory: TestCategory = {
    name: "Private Creations",
    description: "Verifies that private stories are access-controlled (403 for non-owners) and excluded from public Discovery. Generates a real private story end-to-end.",
    testCount: 7,
    run: async (onResult, onStart) => {
        const results: TestResult[] = [];
        const emit = (r: TestResult) => { results.push(r); onResult?.(r); };

        for (const r of await accessControlTests(onStart)) emit(r);
        for (const r of await privateStoryRoundTripTests(onStart)) emit(r);

        return results;
    },
};
