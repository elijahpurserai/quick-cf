/**
 * Content Generation Test Category
 * Tests story and lesson generation via OpenAI WITHOUT saving to the database.
 * Validates: API connectivity, JSON output structure, SEO fields, content quality.
 */

import OpenAI from "openai";
import { TestCategory, TestResult } from "./types";
import { OPENAI_MODEL } from "../config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Helper: run a single test, catching errors. Optionally attach extra details. */
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

// =============================================================================
// Shared: generate content via OpenAI and return parsed JSON (no DB save)
// =============================================================================

interface GeneratedStory {
    title?: string;
    englishTitle?: string;
    description?: string;
    content?: string;
    tags?: string[];
}

interface GeneratedLesson {
    title?: string;
    englishTitle?: string;
    description?: string;
    content?: string;
    tags?: string[];
}

async function generateStoryDryRun(): Promise<GeneratedStory> {
    const systemPrompt = `You are a world-class children's storyteller and SEO specialist. You create magical, engaging stories that are also highly discoverable.
    
    CRITICAL SEO INSTRUCTIONS:
    - "englishTitle": This must be a SEARCH-OPTIMIZED title that someone would type into Google. 
      Format: [Type of Content/Main Topic] for [Age Group] - [Creative Subtitle]
      Example: "Bedtime Story About Dragons for 5 Year Olds - The Purple Adventure"
    - "title": This is the CREATIVE, magical on-page title (e.g., "The Purple Adventure").
    - "description": This must be an SEO-optimized meta description (150-160 characters).
    
    STORY CONTENT INSTRUCTIONS:
    - Incorporate specific details about the child, their family, and their pets.
    - Structure into 3-5 mini-chapters with '### [Emoji] Chapter Name'.
    - Use a few emojis sparingly for magic.
    
    Return the response as a valid JSON object:
    {
      "title": "Creative On-Page Title",
      "englishTitle": "Search-Optimized SEO Title",
      "description": "SEO Meta Description",
      "content": "Full story content with markdown formatting",
      "tags": ["tag1", "tag2"]
    }`;

    const userPrompt = `Generate a bedtime story for:
- Child: Test Child, Gender male, Age 5
- Purpose: bedtime
- Educational Category: General
- Siblings: None
- Pets: None
- Parent(s): None
- Estimated Duration: 5 minutes
- Extra Details: None
- Language: en`;

    const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    if (!raw) throw new Error("No content returned from OpenAI");
    return JSON.parse(raw);
}

async function generateLessonDryRun(): Promise<GeneratedLesson> {
    const systemPrompt = `You are an expert educator and SEO specialist who simplifies complex topics for all ages.
    
    CRITICAL SEO INSTRUCTIONS:
    - "englishTitle": Search-optimized title.
    - "title": Creative on-page title.
    - "description": SEO meta description (150-160 characters).
    
    CONTENT INSTRUCTIONS:
    - Provide rich, descriptive paragraphs. Minimize bullet points.
    - Use Markdown for formatting.
    
    Return the response as a valid JSON object:
    {
      "title": "Creative On-Page Title",
      "englishTitle": "Search-Optimized SEO Title",
      "description": "SEO Meta Description",
      "content": "Full lesson content with markdown formatting",
      "tags": ["tag1", "tag2"]
    }`;

    const userPrompt = `Create a quick lesson about:
- Topic: Why the sky is blue
- Level: Ages 6-10
- Tone: Fun and playful
- Reading Duration: 5 minutes
- Extra Focus: None
- Language: en`;

    const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    if (!raw) throw new Error("No content returned from OpenAI");
    return JSON.parse(raw);
}

// =============================================================================
// Test definitions
// =============================================================================

async function storyGenerationTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    let story: GeneratedStory | null = null;

    // Test 1: Can we generate a story at all?
    const storyGenResult = await runTest("Story generation: OpenAI returns valid JSON", async () => {
        story = await generateStoryDryRun();
        assert(story !== null, "Generated story is null");
        assert(typeof story === "object", "Generated story is not an object");
    }, undefined, onStart);
    storyGenResult.details = story;
    results.push(storyGenResult);

    if (!story) return results; // Skip remaining tests if generation failed

    // Test 2: Required fields exist
    results.push(await runTest("Story generation: has 'title' field", async () => {
        assert(typeof story!.title === "string" && story!.title.length > 0,
            `Expected non-empty string, got: ${JSON.stringify(story!.title)}`);
    }, undefined, onStart));

    results.push(await runTest("Story generation: has 'englishTitle' field", async () => {
        assert(typeof story!.englishTitle === "string" && story!.englishTitle.length > 0,
            `Expected non-empty string, got: ${JSON.stringify(story!.englishTitle)}`);
    }, undefined, onStart));

    results.push(await runTest("Story generation: has 'description' field", async () => {
        assert(typeof story!.description === "string" && story!.description.length > 0,
            `Expected non-empty string, got: ${JSON.stringify(story!.description)}`);
    }, undefined, onStart));

    results.push(await runTest("Story generation: has 'content' field", async () => {
        assert(typeof story!.content === "string" && story!.content.length > 100,
            `Expected content > 100 chars, got ${story!.content?.length || 0} chars`);
    }, undefined, onStart));

    results.push(await runTest("Story generation: has 'tags' array", async () => {
        assert(Array.isArray(story!.tags), `Expected array, got: ${typeof story!.tags}`);
        assert(story!.tags!.length > 0, "Expected at least one tag");
    }, undefined, onStart));

    // Test 3: SEO quality checks
    results.push(await runTest("Story generation: englishTitle is SEO-optimized (contains age/type keywords)", async () => {
        const t = story!.englishTitle!.toLowerCase();
        const hasAgeRef = /\d\s*year|age|kid|child/i.test(t);
        const hasTypeRef = /story|bedtime|adventure|tale/i.test(t);
        assert(hasAgeRef || hasTypeRef,
            `englishTitle "${story!.englishTitle}" should contain age or story type keywords for SEO`);
    }, undefined, onStart));

    results.push(await runTest("Story generation: description is reasonable length (80-250 chars)", async () => {
        const len = story!.description!.length;
        assert(len >= 80 && len <= 250,
            `Description length ${len} chars is outside 80-250 range: "${story!.description}"`);
    }, undefined, onStart));

    // Test 4: Content quality
    results.push(await runTest("Story generation: content has chapter structure", async () => {
        const chapterCount = (story!.content!.match(/###\s/g) || []).length;
        assert(chapterCount >= 2,
            `Expected >= 2 chapters (###), found ${chapterCount}`);
    }, undefined, onStart));

    results.push(await runTest("Story generation: content mentions the child's name", async () => {
        assert(story!.content!.toLowerCase().includes("test child"),
            "Content should mention the child's name 'Test Child'");
    }, undefined, onStart));

    return results;
}

async function lessonGenerationTests(onStart?: (name: string) => void): Promise<TestResult[]> {
    const results: TestResult[] = [];

    let lesson: GeneratedLesson | null = null;

    const lessonGenResult = await runTest("Lesson generation: OpenAI returns valid JSON", async () => {
        lesson = await generateLessonDryRun();
        assert(lesson !== null, "Generated lesson is null");
        assert(typeof lesson === "object", "Generated lesson is not an object");
    }, undefined, onStart);
    lessonGenResult.details = lesson;
    results.push(lessonGenResult);

    if (!lesson) return results;

    results.push(await runTest("Lesson generation: has 'title' field", async () => {
        assert(typeof lesson!.title === "string" && lesson!.title.length > 0,
            `Expected non-empty string, got: ${JSON.stringify(lesson!.title)}`);
    }, undefined, onStart));

    results.push(await runTest("Lesson generation: has 'englishTitle' field", async () => {
        assert(typeof lesson!.englishTitle === "string" && lesson!.englishTitle.length > 0,
            `Expected non-empty string, got: ${JSON.stringify(lesson!.englishTitle)}`);
    }, undefined, onStart));

    results.push(await runTest("Lesson generation: has 'content' field", async () => {
        assert(typeof lesson!.content === "string" && lesson!.content.length > 100,
            `Expected content > 100 chars, got ${lesson!.content?.length || 0} chars`);
    }, undefined, onStart));

    results.push(await runTest("Lesson generation: has 'tags' array", async () => {
        assert(Array.isArray(lesson!.tags), `Expected array, got: ${typeof lesson!.tags}`);
        assert(lesson!.tags!.length > 0, "Expected at least one tag");
    }, undefined, onStart));

    // SEO check
    results.push(await runTest("Lesson generation: englishTitle contains topic keywords", async () => {
        const t = lesson!.englishTitle!.toLowerCase();
        assert(t.includes("sky") || t.includes("blue") || t.includes("science") || t.includes("lesson"),
            `englishTitle "${lesson!.englishTitle}" should reference the topic`);
    }, undefined, onStart));

    // Content references the topic
    results.push(await runTest("Lesson generation: content covers the topic (sky/blue)", async () => {
        const c = lesson!.content!.toLowerCase();
        assert(c.includes("sky") || c.includes("blue") || c.includes("light") || c.includes("scatter"),
            "Lesson content should reference the topic (sky, blue, light, scatter)");
    }, undefined, onStart));

    return results;
}

// =============================================================================
// Export the category
// =============================================================================

export const generationTestCategory: TestCategory = {
    name: "Content Generation",
    description: "Tests story and lesson generation via OpenAI without saving to the database. Validates JSON structure, SEO fields, and content quality.",
    testCount: 17,
    run: async (onResult, onStart) => {
        const results: TestResult[] = [];
        const emit = (r: TestResult) => { results.push(r); onResult?.(r); };

        for (const r of await storyGenerationTests(onStart)) emit(r);
        for (const r of await lessonGenerationTests(onStart)) emit(r);
        return results;
    }
};
