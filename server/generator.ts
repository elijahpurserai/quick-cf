import { Router, Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import { z } from "zod";
import crypto from "crypto";
import { authenticateJWT } from "./auth";
import { supabase } from "./supabase";
import {
    APPROVED_EMAILS,
    EDUCATION_CATEGORIES,
    OPENAI_MODEL,
    SUGGESTION_COUNT,
    DEFAULT_STORY_DURATION,
    DEFAULT_LESSON_DURATION,
    BATCH_CONCURRENCY,
} from "./config";
import {
    SEED_STORY_SYSTEM_PROMPT,
    SEED_LESSON_SYSTEM_PROMPT,
    SUGGEST_PROMPTS_SYSTEM_PROMPT,
    SUGGEST_PROMPTS_EDUCATION_INSTRUCTIONS,
    IMAGE_PROMPT_TEMPLATE,
    interpolatePrompt,
} from "./prompts";

export const generatorRoutes = Router();

// EDUCATION_CATEGORIES imported from ./config

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface AuthRequest extends Request {
    user?: any;
}

// Middleware to check if user is approved
const isApproved = (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !APPROVED_EMAILS.includes(user.email)) {
        return res.status(403).json({ error: "Unauthorized: Access restricted to approved users." });
    }
    next();
};

const SuggestPromptsSchema = z.object({
    type: z.enum(["story", "lesson"]),
    basePrompt: z.string(),
});

const GenerateSeedContentSchema = z.object({
    type: z.enum(["story", "lesson"]),
    title: z.string(),
    prompt: z.string(),
});

const BatchSchema = z.object({
    type: z.enum(["story", "lesson"]),
    items: z.array(z.object({
        title: z.string(),
        prompt: z.string(),
    })),
});

// Helper to generate SEO-friendly slugs
const slugify = (text: string) => {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // remove non-word chars
        .replace(/\s+/g, '-')     // replace spaces with hyphens
        .replace(/-+/g, '-')      // replace multiple hyphens with single hyphen
        .trim();
};

const generateSlug = (text: string) => {
    const kebab = slugify(text);
    const shortId = crypto.randomBytes(3).toString('hex'); // 6 chars
    return `${kebab}-${shortId}`;
};

/**
 * Maps a reading duration (minutes) to a target word count and chapter range.
 * Based on ~150 words per minute for children's read-aloud pace.
 */
const getStoryLengthGuidance = (durationMinutes: number) => {
    const wordsPerMinute = 150;
    const targetWords = durationMinutes * wordsPerMinute;

    let chapters: string;
    if (durationMinutes <= 5) {
        chapters = '2-3';
    } else if (durationMinutes <= 7) {
        chapters = '3-4';
    } else if (durationMinutes <= 10) {
        chapters = '4-5';
    } else if (durationMinutes <= 15) {
        chapters = '5-7';
    } else {
        chapters = '6-8';
    }

    return { targetWords, chapters };
};

// =============================================================================
// Suggest Prompts
// =============================================================================

generatorRoutes.post("/suggest-prompts", authenticateJWT, isApproved, async (req: AuthRequest, res) => {
    try {
        const { type, basePrompt } = SuggestPromptsSchema.parse(req.body);

        const educationInstructions = type === "story"
            ? interpolatePrompt(SUGGEST_PROMPTS_EDUCATION_INSTRUCTIONS, { educationCategories: EDUCATION_CATEGORIES.join(", ") })
            : "";

        const systemPrompt = interpolatePrompt(SUGGEST_PROMPTS_SYSTEM_PROMPT, {
            typeDescription: type === "story" ? "bedtime stories (including educational ones)" : "educational lessons",
            educationInstructions,
            basePrompt,
            suggestionCount: SUGGESTION_COUNT,
            type,
        });

        const completion = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages: [{ role: "system", content: systemPrompt }],
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("No suggestions generated");

        res.json(JSON.parse(content));
    } catch (error) {
        console.error("Suggest Prompts Error:", error);
        res.status(500).json({ error: "Failed to suggest prompts", details: error instanceof Error ? error.message : String(error) });
    }
});

// =============================================================================
// Single Content Generation (backward-compatible)
// =============================================================================

generatorRoutes.post("/generate-seed-content", authenticateJWT, isApproved, async (req: AuthRequest, res) => {
    try {
        const { type, title, prompt } = GenerateSeedContentSchema.parse(req.body);
        const userId = req.user?.id;
        const result = await generateAndSaveSeedContent(type, title, prompt, userId);
        res.json(result);
    } catch (error) {
        console.error("Generate Seed Content Error:", error);
        res.status(500).json({ error: "Failed to generate seed content", details: error instanceof Error ? error.message : String(error) });
    }
});

// =============================================================================
// Batch Content Generation with SSE streaming
// =============================================================================

generatorRoutes.post("/generate-seed-batch/stream", authenticateJWT, isApproved, async (req: AuthRequest, res) => {
    let parsed;
    try {
        parsed = BatchSchema.parse(req.body);
    } catch (error) {
        return res.status(400).json({ error: "Invalid batch request", details: error instanceof Error ? error.message : String(error) });
    }

    const { type, items } = parsed;
    const userId = req.user?.id;

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let succeeded = 0;
    let failed = 0;

    // Build a shared queue of items
    const queue = items.map((item, index) => ({ ...item, index }));

    const runWorker = async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) break;

            send("item_start", { index: item.index, title: item.title });

            try {
                const result = await generateAndSaveSeedContent(type, item.title, item.prompt, userId);
                succeeded++;
                send("item_done", {
                    index: item.index,
                    title: result.title,
                    id: result.id,
                    slug: result.slug,
                    description: result.description,
                    status: "success",
                });

                // Fire image generation in the background and stream the result
                if (result.id && result.title) {
                    generateImageForCreation(result.id, result.imagePrompt || result.description || item.prompt).then(() => {
                        send("image_done", { index: item.index, id: result.id, title: result.title });
                    }).catch((err) => {
                        send("image_error", { index: item.index, id: result.id, error: err instanceof Error ? err.message : String(err) });
                    });
                }
            } catch (error) {
                failed++;
                send("item_error", {
                    index: item.index,
                    title: item.title,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    };

    // Start concurrent workers (limited by BATCH_CONCURRENCY)
    const workerCount = Math.min(BATCH_CONCURRENCY, queue.length);
    const workers: Promise<void>[] = [];
    for (let i = 0; i < workerCount; i++) {
        workers.push(runWorker());
    }

    await Promise.all(workers);

    send("done", { total: items.length, succeeded, failed });
    res.end();
});

// =============================================================================
// Core generation helper (used by both single + batch endpoints)
// =============================================================================

async function generateAndSaveSeedContent(
    type: "story" | "lesson",
    title: string,
    prompt: string,
    userId?: string
): Promise<{ id: string; slug: string; title: string; description?: string; imagePrompt?: string }> {
    if (type === "story") {
        const { targetWords, chapters } = getStoryLengthGuidance(DEFAULT_STORY_DURATION);
        const systemPrompt = interpolatePrompt(SEED_STORY_SYSTEM_PROMPT, {
            prompt,
            targetWords,
            duration: DEFAULT_STORY_DURATION,
            chapters,
            educationCategories: EDUCATION_CATEGORIES.join(", "),
        });

        const completion = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            temperature: 0.6,
            messages: [{ role: "system", content: systemPrompt }],
            response_format: { type: "json_object" },
        });

        const generatedData = JSON.parse(completion.choices[0].message.content || "{}");
        const finalTitle = generatedData.title || title;
        const englishTitle = generatedData.englishTitle || finalTitle;
        const slug = generateSlug(englishTitle);
        const storyId = crypto.randomUUID();

        const { error: creationError } = await supabase.from('creations').insert({
            id: storyId,
            owner_id: userId,
            type: 'story',
            slug,
            title: finalTitle,
            english_title: englishTitle,
            description: generatedData.description,
            visibility: "public"
        });
        if (creationError) throw creationError;

        const { error: storyError } = await supabase.from('stories').insert({
            id: storyId,
            content: generatedData.content,
            child_name: generatedData.childName || "A Friend",
            age: Number(generatedData.age) || 5,
            gender: ["male", "female", "unspecified"].includes(generatedData.gender) ? generatedData.gender : "unspecified",
            purpose: generatedData.purpose || "Storytelling",
            education_category: generatedData.educationCategory || "General",
            duration_mins: DEFAULT_STORY_DURATION,
            language: generatedData.language || "en",
            metadata: {
                additionalInfo: generatedData.additionalInfo || "",
                imagePrompt: generatedData.imagePrompt || ""
            }
        });
        if (storyError) throw storyError;

        if (generatedData.tags && generatedData.tags.length > 0) {
            for (const tagName of generatedData.tags) {
                const tagSlug = slugify(tagName);
                const { data: tag } = await supabase
                    .from('tags')
                    .upsert({ name: tagName, slug: tagSlug }, { onConflict: 'name' })
                    .select('id')
                    .single();
                if (tag) {
                    await supabase.from('creation_tags').insert({
                        creation_id: storyId,
                        tag_id: tag.id
                    });
                }
            }
        }

        return { id: storyId, slug, title: finalTitle, description: generatedData.description, imagePrompt: generatedData.imagePrompt };

    } else {
        const systemPrompt = interpolatePrompt(SEED_LESSON_SYSTEM_PROMPT, {
            prompt,
            duration: DEFAULT_LESSON_DURATION,
        });

        const completion = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            temperature: 0.6,
            messages: [{ role: "system", content: systemPrompt }],
            response_format: { type: "json_object" },
        });

        const generatedData = JSON.parse(completion.choices[0].message.content || "{}");
        const finalTitle = generatedData.title || title;
        const englishTitle = generatedData.englishTitle || finalTitle;
        const slug = generateSlug(englishTitle);
        const lessonId = crypto.randomUUID();

        const { error: creationError } = await supabase.from('creations').insert({
            id: lessonId,
            owner_id: userId,
            type: 'lesson',
            slug,
            title: finalTitle,
            english_title: englishTitle,
            description: generatedData.description,
            visibility: "public"
        });
        if (creationError) throw creationError;

        const { error: lessonError } = await supabase.from('lessons').insert({
            id: lessonId,
            content: generatedData.content,
            topic: generatedData.topic || finalTitle,
            level: generatedData.level || "General",
            tone: generatedData.tone || "Fun",
            duration_mins: Number(generatedData.duration_mins) || DEFAULT_LESSON_DURATION,
            language: generatedData.language || "en"
        });
        if (lessonError) throw lessonError;

        if (generatedData.tags && generatedData.tags.length > 0) {
            for (const tagName of generatedData.tags) {
                const tagSlug = slugify(tagName);
                const { data: tag } = await supabase
                    .from('tags')
                    .upsert({ name: tagName, slug: tagSlug }, { onConflict: 'name' })
                    .select('id')
                    .single();
                if (tag) {
                    await supabase.from('creation_tags').insert({
                        creation_id: lessonId,
                        tag_id: tag.id
                    });
                }
            }
        }

        return { id: lessonId, slug, title: finalTitle, description: generatedData.description, imagePrompt: generatedData.imagePrompt };
    }
}

// =============================================================================
// Image generation helper (used by batch endpoint for inline image gen)
// =============================================================================

async function generateImageForCreation(creationId: string, imagePrompt: string): Promise<void> {
    // Always wrap with the no-text template for safety
    const prompt = interpolatePrompt(IMAGE_PROMPT_TEMPLATE, { imagePrompt });

    if (process.env.NODE_ENV !== "production") {
        console.log("[ImageGen] Batch prompt:", prompt);
    }

    const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        size: "1536x1024",
        quality: "medium",
    });

    // gpt-image-1 returns base64-encoded image bytes (no temporary URL).
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data returned");
    let buffer = Buffer.from(b64, "base64");

    // NOTE: sharp (native libvips) does not run on Cloudflare Workers, so the in-request
    // WebP resize was removed. The original gpt-image-1 PNG is stored as-is; display and OG
    // delivery use Supabase Storage on-the-fly transforms (see server/image_utils.ts).
    // To reclaim the ≤500KB WebP at rest, re-optimize with the local tool (tools/, keeps sharp).
    const isWebp = false;

    const ext = isWebp ? 'webp' : 'png';
    const fileContentType = isWebp ? 'image/webp' : 'image/png';
    const fileName = `${creationId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from('creations')
        .upload(fileName, buffer, {
            contentType: fileContentType,
            cacheControl: '31536000', // Cache for 1 year
            upsert: true
        });

    if (uploadError) {
        console.error(`[Batch Image] Upload failed for ${creationId}:`, uploadError);
        throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
        .from('creations')
        .getPublicUrl(fileName);

    const { error: dbError } = await supabase
        .from('creations')
        .update({ image_url: publicUrl })
        .eq('id', creationId);

    if (dbError) {
        console.error(`[Batch Image] DB update failed for ${creationId}:`, dbError);
        throw dbError;
    }

    console.log(`[Batch Image] Done for ${creationId}: ${publicUrl}`);
}
