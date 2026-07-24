import { Router, Request } from "express";
import OpenAI from "openai";
import { z } from "zod";
import crypto from "crypto";
import { authenticateJWT } from "./auth";
import { supabase } from "./supabase";
import {
    OPENAI_MODEL,
    IMAGE_MODEL,
    IMAGE_SIZE,
    IMAGE_QUALITY,
    IMAGE_STYLE,
    TTS_MODEL,
    TTS_DEFAULT_VOICE,
} from "./config";
import {
    USER_STORY_SYSTEM_PROMPT,
    USER_STORY_USER_PROMPT,
    USER_LESSON_SYSTEM_PROMPT,
    USER_LESSON_USER_PROMPT,
    IMAGE_PROMPT_TEMPLATE,
    interpolatePrompt,
} from "./prompts";

interface AuthRequest extends Request {
    user?: any;
}

export const storyRoutes = Router();
export const lessonRoutes = Router();

// Zod schemas for validation
const StorySchema = z.object({
    childName: z.string(),
    gender: z.enum(["male", "female", "unspecified"]),
    age: z.union([z.string(), z.number()]),
    educationCategory: z.string().optional(),
    siblingNames: z.array(z.object({
        name: z.string(),
        gender: z.enum(["male", "female", "unspecified"]),
    })).optional(),
    pets: z.array(z.object({
        name: z.string(),
        type: z.string(),
    })).optional(),
    parentNames: z.array(z.object({
        name: z.string(),
        gender: z.enum(["male", "female", "unspecified"]),
    })).optional(),
    duration: z.number(),
    language: z.string(),
    additionalInfo: z.string().optional(),
    purpose: z.string(),
    visibility: z.enum(["public", "unlisted", "private"]).optional().default("public"),
});

const LessonSchema = z.object({
    topic: z.string(),
    level: z.string(),
    tone: z.string(),
    additionalInfo: z.string().optional(),
    duration: z.number().min(1).max(45),
    language: z.string(),
    visibility: z.enum(["public", "unlisted", "private"]).optional().default("public"),
});


// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Helper to generate SEO-friendly slugs
// Uses Unicode-aware regex so non-Latin scripts (Hebrew, Arabic, etc.) are preserved
const slugify = (text: string) => {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '') // remove non-letter/number chars (Unicode-aware)
        .replace(/\s+/g, '-')               // replace spaces with hyphens
        .replace(/-+/g, '-')                // replace multiple hyphens with single hyphen
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

// Helper to map database creation objects (with joins) to public API format
const mapCreationToPublic = (creation: any, tags: any[] = []) => {
    const details = creation.stories || creation.lessons || {};
    const metadata = details.metadata || {};

    return {
        ...creation,
        ...details, // Flatten joined fields
        tags: (tags || []).map((t: any) => {
            const name = typeof t === 'string' ? t : (t.tags?.name || t.name || '');
            const storedSlug = typeof t === 'string' ? slugify(t) : (t.tags?.slug || t.slug || '');
            // Self-heal: if stored slug is empty (old data), compute it from the name
            const slug = storedSlug || slugify(name);
            return { name, slug };
        }),
        chapters: metadata.chapters || [],
        siblings: metadata.siblings || [],
        parentNames: metadata.parentNames || [],
        pets: metadata.pets || [],
        imagePrompt: metadata.imagePrompt || "",
        createdAt: creation.created_at,
        rating: creation.rating_avg || 0,
        ratingsCount: creation.rating_count || 0,
        imageUrl: creation.image_url,
        ownerId: creation.owner_id,
        visibility: creation.visibility,
        // Map snake_case to camelCase for frontend
        childName: details.child_name,
        educationCategory: details.education_category,
        duration: (details.duration_mins && details.duration_mins <= 45) ? details.duration_mins : 7,
        // Ensure some fields are definitely present for StoryCard
        age: details.age || 0,
        purpose: details.purpose || "adventure"
    };
};

// Helper to handle API errors consistently
const handleApiError = (res: any, error: any, context: string) => {
    console.error(`${context} error:`, error);

    if (error instanceof z.ZodError) {
        return res.status(400).json({
            error: `Invalid ${context.toLowerCase()} data`,
            details: error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
    }

    // Handle Supabase/Postgres errors (which might not be instances of Error)
    let details = "Unknown error";
    if (error instanceof Error) {
        details = error.message;
    } else if (typeof error === 'object' && error !== null) {
        details = error.message || error.details || JSON.stringify(error);
    } else {
        details = String(error);
    }

    res.status(500).json({
        error: `Failed to generate ${context.toLowerCase()}`,
        details
    });
};

// Batch-fetch tags for multiple creations in a single query (avoids N+1)
const batchFetchTags = async (creationIds: string[]) => {
    if (creationIds.length === 0) return new Map<string, any[]>();

    const { data: allTags } = await supabase
        .from('creation_tags')
        .select('creation_id, tags(name, slug)')
        .in('creation_id', creationIds);

    const tagMap = new Map<string, any[]>();
    for (const row of (allTags || [])) {
        const existing = tagMap.get(row.creation_id) || [];
        existing.push(row.tags);
        tagMap.set(row.creation_id, existing);
    }
    return tagMap;
};

// Map an array of creations with batched tags
const mapCreationsWithTags = async (creations: any[]) => {
    const ids = creations.map(c => c.id);
    const tagMap = await batchFetchTags(ids);
    return creations.map(creation =>
        mapCreationToPublic(creation, tagMap.get(creation.id) || [])
    );
};

storyRoutes.post("/generate-story", authenticateJWT, async (req: AuthRequest, res) => {
    try {
        const formData = StorySchema.parse(req.body);
        const userId = req.user?.id || "anonymous";
        const { targetWords, chapters } = getStoryLengthGuidance(formData.duration);

        const systemPrompt = interpolatePrompt(USER_STORY_SYSTEM_PROMPT, {
            targetWords,
            duration: formData.duration,
            chapters,
        });

        const userPrompt = interpolatePrompt(USER_STORY_USER_PROMPT, {
            childName: formData.childName,
            gender: formData.gender,
            age: formData.age,
            purpose: formData.purpose,
            educationCategory: formData.educationCategory || "General",
            siblings: formData.siblingNames?.map((s: any) => `${s.name} (${s.gender})`).join(", ") || "None",
            pets: formData.pets?.map((p: any) => `${p.name} the ${p.type}`).join(", ") || "None",
            parents: formData.parentNames?.map((p: any) => `${p.name} (${p.gender})`).join(", ") || "None",
            targetWords,
            duration: formData.duration,
            additionalInfo: formData.additionalInfo || "None",
            language: formData.language,
        });

        const completion = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            temperature: 0.6,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("No content generated");

        const generatedData = JSON.parse(completion.choices[0].message.content || "{}");
        const englishTitle = generatedData.englishTitle || generatedData.title || "story";
        const slug = generateSlug(englishTitle);

        const storyData = {
            id: crypto.randomUUID(),
            slug,
            englishTitle,
            title: generatedData.title,
            description: generatedData.description,
            content: generatedData.content,
            tags: generatedData.tags,
            imagePrompt: generatedData.imagePrompt || "",
            ownerId: userId === "anonymous" ? null : userId,
            createdAt: new Date().toISOString(),
            rating: 0,
            ratingsCount: 0,
            age: formData.age,
            gender: formData.gender,
            chapters: [],
            purpose: formData.purpose,
            childName: formData.childName,
            educationCategory: formData.educationCategory || "General",
            duration: formData.duration,
            language: formData.language,
            siblings: formData.siblingNames,
            parentNames: formData.parentNames,
            pets: formData.pets,
        };

        // Persist to Supabase
        console.log(`[DB] Saving creation: ${storyData.id}`);
        const { error: creationError } = await supabase
            .from('creations')
            .insert({
                id: storyData.id,
                owner_id: storyData.ownerId,
                type: 'story',
                slug: storyData.slug,
                title: storyData.title,
                english_title: storyData.englishTitle,
                description: storyData.description,
                visibility: formData.visibility ?? "public"
            });

        if (creationError) {
            console.error('[DB] Creation Error:', creationError);
            throw creationError;
        }
        console.log('[DB] Creation saved.');

        const { error: storyError } = await supabase
            .from('stories')
            .insert({
                id: storyData.id,
                content: storyData.content,
                child_name: storyData.childName,
                age: Number(storyData.age),
                gender: storyData.gender,
                purpose: storyData.purpose,
                education_category: storyData.educationCategory,
                duration_mins: storyData.duration,
                language: storyData.language,
                metadata: {
                    siblings: storyData.siblings,
                    parentNames: storyData.parentNames,
                    pets: storyData.pets,
                    imagePrompt: storyData.imagePrompt
                }
            });

        if (storyError) {
            console.error('[DB] Story Insert Error Detail:', {
                message: storyError.message,
                details: storyError.details,
                hint: storyError.hint,
                code: storyError.code
            });
            throw storyError;
        }
        console.log('[DB] Story detailed entry saved successfully');

        // Handle tags
        if (storyData.tags && storyData.tags.length > 0) {
            for (const tagName of storyData.tags) {
                const tagSlug = slugify(tagName);
                const { data: tag, error: tagError } = await supabase
                    .from('tags')
                    .upsert({ name: tagName, slug: tagSlug }, { onConflict: 'name' })
                    .select('id')
                    .single();

                if (tag) {
                    await supabase.from('creation_tags').insert({
                        creation_id: storyData.id,
                        tag_id: tag.id
                    });
                }
            }
        }
        res.json(storyData);

    } catch (error) {
        handleApiError(res, error, "Story");
    }
});

storyRoutes.post("/generate-story-image", async (req, res) => {
    try {
        const { title, description, imagePrompt: clientImagePrompt } = req.body;
        if (!title || (!description && !clientImagePrompt)) {
            return res.status(400).json({ error: "Title and description (or imagePrompt) are required" });
        }

        // Always wrap with the no-text template; prefer AI imagePrompt, fall back to description
        const imageContent = clientImagePrompt || description;
        const prompt = interpolatePrompt(IMAGE_PROMPT_TEMPLATE, { imagePrompt: imageContent });

        if (process.env.NODE_ENV !== "production") {
            console.log("[ImageGen] Prompt:", prompt);
        }

        const response = await openai.images.generate({
            model: IMAGE_MODEL,
            prompt: prompt,
            n: 1,
            size: IMAGE_SIZE,
            quality: IMAGE_QUALITY,
        });

        // gpt-image-1 returns base64-encoded image bytes (no temporary URL).
        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error("No image data returned");
        let buffer = Buffer.from(b64, "base64");

        // --- Permanent Storage Logic ---
        const { creationId } = req.body;
        console.log(`[Storage] Check: creationId=${creationId}`);
        // No creationId to attach permanent storage to → return an inline data URL fallback.
        let finalImageUrl = `data:image/png;base64,${b64}`;

        if (creationId) {
            try {
                console.log(`[Storage] Moving image for ${creationId} to permanent storage...`);
                console.log(`[Storage] 1. Decoded ${buffer.length} bytes from OpenAI (base64).`);

                // NOTE: sharp (native libvips) does not run on Cloudflare Workers, so the
                // in-request WebP resize was removed. The original gpt-image-1 PNG is stored as-is;
                // display and OG delivery are handled by Supabase Storage on-the-fly transforms
                // (see server/image_utils.ts — toDisplayImageUrl / toOgImageUrl). To reclaim the
                // ≤500KB WebP at rest, re-optimize with the local tool (tools/, runs under ts-node
                // and keeps sharp) or add a Cloudflare Images transform at upload time.
                const isWebp = false;

                // 2. Upload to Supabase Storage
                const ext = isWebp ? 'webp' : 'png';
                const fileContentType = isWebp ? 'image/webp' : 'image/png';
                const fileName = `${creationId}/${Date.now()}.${ext}`;
                console.log(`[Storage] 2. Uploading to bucket 'creations' as ${fileName}`);
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('creations')
                    .upload(fileName, buffer, {
                        contentType: fileContentType,
                        cacheControl: '31536000', // Cache for 1 year
                        upsert: true
                    });

                if (uploadError) {
                    console.error("[Storage] Upload failed:", uploadError);
                } else {
                    // 3. Get Public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('creations')
                        .getPublicUrl(fileName);

                    finalImageUrl = publicUrl;
                    console.log(`[Storage] 3. Permanent URL: ${finalImageUrl}`);

                    // 4. Update Database
                    console.log(`[Storage] 4. Updating DB for ${creationId}`);
                    const { error: dbError } = await supabase
                        .from('creations')
                        .update({ image_url: finalImageUrl })
                        .eq('id', creationId);

                    if (dbError) {
                        console.error("[DB] Failed to update permanent URL:", dbError);
                    } else {
                        console.log(`[Storage] 4. DB update success!`);
                    }
                }
            } catch (storageErr) {
                console.error("[Storage] Process failed:", storageErr);
            }
        }

        res.json({ imageUrl: finalImageUrl });

    } catch (error) {
        handleApiError(res, error, "Story Image");
    }
});

storyRoutes.post("/generate-story-audio", async (req, res) => {
    try {
        const { text, voice = TTS_DEFAULT_VOICE } = req.body;
        if (!text) {
            return res.status(400).json({ error: "Text is required" });
        }

        const mp3 = await openai.audio.speech.create({
            model: TTS_MODEL,
            voice: voice as any,
            input: text,
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        res.set({
            "Content-Type": "audio/mpeg",
            "Content-Length": buffer.length,
        });
        res.send(buffer);

    } catch (error) {
        handleApiError(res, error, "Story Audio");
    }
});


lessonRoutes.post("/generate-lesson", authenticateJWT, async (req: AuthRequest, res) => {
    try {
        const formData = LessonSchema.parse(req.body);
        const userId = req.user?.id || "anonymous";
        const { targetWords } = getStoryLengthGuidance(formData.duration);

        const systemPrompt = interpolatePrompt(USER_LESSON_SYSTEM_PROMPT, {
            targetWords,
            duration: formData.duration,
        });

        const userPrompt = interpolatePrompt(USER_LESSON_USER_PROMPT, {
            topic: formData.topic,
            level: formData.level,
            tone: formData.tone,
            targetWords,
            duration: formData.duration,
            additionalInfo: formData.additionalInfo || "None",
            language: formData.language,
        });

        const completion = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            temperature: 0.6,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
        });

        const generatedData = JSON.parse(completion.choices[0].message.content || "{}");
        const englishTitle = generatedData.englishTitle || generatedData.title || "lesson";
        const slug = generateSlug(englishTitle);

        const lessonData = {
            id: crypto.randomUUID(),
            slug,
            englishTitle,
            topic: generatedData.title || formData.topic,
            level: formData.level,
            tone: formData.tone,
            duration: formData.duration,
            language: formData.language,
            content: generatedData.content,
            tags: generatedData.tags || [],
            imagePrompt: generatedData.imagePrompt || "",
            ownerId: userId === "anonymous" ? null : userId,
            createdAt: new Date().toISOString(),
            rating: 0,
            ratingsCount: 0
        };

        // Persist to Supabase
        console.log(`[DB] Saving lesson: ${lessonData.id}`);
        const { error: creationError } = await supabase
            .from('creations')
            .insert({
                id: lessonData.id,
                owner_id: lessonData.ownerId,
                type: 'lesson',
                slug: lessonData.slug,
                title: lessonData.topic,
                english_title: lessonData.englishTitle,
                description: generatedData.description,
                visibility: formData.visibility ?? "public"
            });

        if (creationError) {
            console.error('[DB] Lesson Creation Error:', creationError);
            throw creationError;
        }
        console.log('[DB] Lesson creation saved.');

        const { error: lessonError } = await supabase
            .from('lessons')
            .insert({
                id: lessonData.id,
                content: lessonData.content,
                topic: lessonData.topic,
                level: lessonData.level,
                tone: lessonData.tone,
                duration_mins: lessonData.duration,
                language: lessonData.language
            });

        if (lessonError) {
            console.error('[DB] Lesson Insert Error Detail:', {
                message: lessonError.message,
                details: lessonError.details,
                hint: lessonError.hint,
                code: lessonError.code
            });
            throw lessonError;
        }
        console.log('[DB] Lesson detailed entry saved successfully');

        // Handle tags
        if (lessonData.tags && lessonData.tags.length > 0) {
            for (const tagName of lessonData.tags) {
                const tagSlug = slugify(tagName);
                const { data: tag, error: tagError } = await supabase
                    .from('tags')
                    .upsert({ name: tagName, slug: tagSlug }, { onConflict: 'name' })
                    .select('id')
                    .single();

                if (tag) {
                    await supabase.from('creation_tags').insert({
                        creation_id: lessonData.id,
                        tag_id: tag.id
                    });
                }
            }
        }
        res.json(lessonData);

    } catch (error) {
        handleApiError(res, error, "Lesson");
    }
});

// --- Story Retrieval Routes ---

storyRoutes.get("/stories/s/:slug", authenticateJWT, async (req: AuthRequest, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user?.id;

        // 1. Fetch from creations
        const { data: creation, error: creationError } = await supabase
            .from('creations')
            .select('*')
            .eq('slug', slug)
            .single();

        if (creationError || !creation) {
            return res.status(404).json({ error: "Story not found" });
        }

        // 2. Check ownership if private (unlisted is accessible to anyone with the link)
        if (creation.visibility === "private" && creation.owner_id !== userId) {
            return res.status(403).json({ error: "Unauthorized access to this story" });
        }

        // 3. Fetch story details
        const { data: story, error: storyError } = await supabase
            .from('stories')
            .select('*')
            .eq('id', creation.id)
            .single();

        if (storyError || !story) {
            return res.status(404).json({ error: "Story details not found" });
        }

        // 4. Fetch tags
        const { data: tagData, error: tagDataError } = await supabase
            .from('creation_tags')
            .select('tags(name, slug)')
            .eq('creation_id', creation.id);

        // Combine data using the helper
        const storyData = mapCreationToPublic({ ...creation, stories: story }, tagData?.map((t: any) => t.tags) || []);
        storyData.chapters = []; // Chapters not yet in DB

        res.json(storyData);
    } catch (error) {
        handleApiError(res, error, "Story retrieval");
    }
});

// --- Lesson Retrieval Routes ---

lessonRoutes.get("/lessons/s/:slug", authenticateJWT, async (req: AuthRequest, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user?.id;

        // 1. Fetch from creations
        const { data: creation, error: creationError } = await supabase
            .from('creations')
            .select('*')
            .eq('slug', slug)
            .single();

        if (creationError || !creation) {
            return res.status(404).json({ error: "Lesson not found" });
        }

        // 2. Check ownership if private (unlisted is accessible to anyone with the link)
        if (creation.visibility === "private" && creation.owner_id !== userId) {
            return res.status(403).json({ error: "Unauthorized access to this lesson" });
        }

        // 3. Fetch lesson details
        const { data: lesson, error: lessonError } = await supabase
            .from('lessons')
            .select('*')
            .eq('id', creation.id)
            .single();

        if (lessonError || !lesson) {
            return res.status(404).json({ error: "Lesson details not found" });
        }

        // 4. Fetch tags
        const { data: tagData, error: tagDataError } = await supabase
            .from('creation_tags')
            .select('tags(name, slug)')
            .eq('creation_id', creation.id);

        // Combine data using the helper
        const lessonData = mapCreationToPublic({ ...creation, lessons: lesson }, tagData?.map((t: any) => t.tags) || []);

        res.json(lessonData);
    } catch (error) {
        handleApiError(res, error, "Lesson retrieval");
    }
});

// --- Update Visibility ---

storyRoutes.patch("/creations/:id/visibility", authenticateJWT, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }

        const { visibility } = req.body;
        if (!["public", "unlisted", "private"].includes(visibility)) {
            return res.status(400).json({ error: "Invalid visibility value. Must be 'public', 'unlisted', or 'private'" });
        }

        // Verify ownership
        const { data: creation, error: fetchError } = await supabase
            .from('creations')
            .select('owner_id')
            .eq('id', id)
            .single();

        if (fetchError || !creation) {
            return res.status(404).json({ error: "Creation not found" });
        }

        if (creation.owner_id !== userId) {
            return res.status(403).json({ error: "Only the owner can change visibility" });
        }

        // Update
        const { error: updateError } = await supabase
            .from('creations')
            .update({ visibility })
            .eq('id', id);

        if (updateError) throw updateError;

        res.json({ visibility });
    } catch (error) {
        handleApiError(res, error, "Update visibility");
    }
});

// --- Discovery Routes ---

const discoveryRoutes = Router();

// Get public creations (stories and lessons)
discoveryRoutes.get("/public", async (req, res) => {
    try {
        const { type, sort = 'latest', limit = 20, offset = 0, q, lang, age } = req.query;

        let query = supabase
            .from('creations')
            .select(`
                *,
                stories(content, purpose, education_category, duration_mins, age, child_name, gender, language, metadata),
                lessons(content, topic, level, tone, duration_mins, language)
            `)
            .eq('visibility', 'public');

        if (type) {
            query = query.eq('type', type);
        }

        if (q && typeof q === 'string') {
            query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
        }

        if (sort === 'rating') {
            query = query.order('rating_avg', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const from = Number(offset);
        const requestedLimit = Number(limit);

        // When filtering by language or age, skip range() and fetch all rows
        // (these fields live in joined stories/lessons table, can't filter at DB level)
        const needsPostFilter = (lang && typeof lang === 'string') || (age && typeof age === 'string');
        let data: any[] | null, error: any;
        if (needsPostFilter) {
            ({ data, error } = await query);
        } else {
            const to = from + requestedLimit - 1;
            ({ data, error } = await query.range(from, to));
        }

        if (error) throw error;

        let results = data || [];
        console.log(`[discovery/public] total rows from DB: ${results.length}, lang=${lang}, age=${age}, type=${type}`);

        // Filter by language (post-query since language lives in the joined stories/lessons table)
        if (lang && typeof lang === 'string') {
            results = results.filter((c: any) => {
                const detail = c.stories || c.lessons;
                return detail && detail.language === lang;
            });
            console.log(`[discovery/public] after lang filter: ${results.length}`);
        }

        // Filter by age (post-query since age lives in the joined stories table)
        if (age && typeof age === 'string') {
            const ageNum = parseInt(age, 10);
            if (!isNaN(ageNum)) {
                // Log sample ages to diagnose type mismatch
                const sampleAges = results.slice(0, 5).map((c: any) => ({ age: c.stories?.age, type: typeof c.stories?.age }));
                console.log(`[discovery/public] filtering age=${ageNum}, sample story ages:`, sampleAges);
                results = results.filter((c: any) => c.stories && c.stories.age === ageNum);
                console.log(`[discovery/public] after age filter: ${results.length}`);
            }
        }

        // Apply pagination after post-query filtering
        if (needsPostFilter) {
            results = results.slice(from, from + requestedLimit);
        }

        const creationsWithTags = await mapCreationsWithTags(results);
        res.json(creationsWithTags);
    } catch (error) {
        handleApiError(res, error, "Public discovery");
    }
});

// Get all tags with counts
discoveryRoutes.get("/tags", async (req, res) => {
    try {
        const { lang } = req.query;

        // 1. Fetch all tags (flat, no joins)
        const { data: tags, error: tagsError } = await supabase
            .from('tags')
            .select('id, name, slug');

        if (tagsError) throw tagsError;
        if (!tags || tags.length === 0) return res.json([]);

        // 2. Fetch creation_tag associations (flat, no joins)
        const { data: ctData, error: ctError } = await supabase
            .from('creation_tags')
            .select('tag_id, creation_id')
            .limit(10000);

        if (ctError) throw ctError;
        if (!ctData || ctData.length === 0) return res.json([]);

        // 3. Get unique creation IDs referenced by tags
        const creationIds = [...new Set(ctData.map((ct: any) => ct.creation_id))];

        // 4. Fetch those creations with visibility + language info
        const { data: creations, error: crError } = await supabase
            .from('creations')
            .select('id, visibility, type, stories(language), lessons(language)')
            .in('id', creationIds)
            .eq('visibility', 'public');

        if (crError) throw crError;

        // 5. Build a set of valid (public + language-matched) creation IDs
        const validCreationIds = new Set<string>();
        for (const c of (creations || [])) {
            const detail = c.stories || c.lessons;
            // If lang filter is active, skip creations that don't match
            if (lang && typeof lang === 'string') {
                if (!detail || (detail as any).language !== lang) continue;
            }
            validCreationIds.add(c.id);
        }

        // 6. Count per tag using only valid creations
        const countsByTag: Record<string, number> = {};
        for (const ct of ctData) {
            if (validCreationIds.has(ct.creation_id)) {
                countsByTag[ct.tag_id] = (countsByTag[ct.tag_id] || 0) + 1;
            }
        }

        const formattedTags = tags.map((tag: any) => ({
            name: tag.name,
            slug: tag.slug,
            count: countsByTag[tag.id] || 0
        })).filter((t: any) => t.count > 0);

        res.json(formattedTags);
    } catch (error) {
        handleApiError(res, error, "Tags retrieval");
    }
});

// Get creations by tag slug
discoveryRoutes.get("/tags/s/:tagSlug", async (req, res) => {
    try {
        const { tagSlug } = req.params;
        const { lang } = req.query;

        // 1. Get tag ID by slug; fall back to name lookup for old tags with empty slugs
        const { data: tagBySlug } = await supabase
            .from('tags')
            .select('id')
            .eq('slug', tagSlug)
            .maybeSingle();

        let tag = tagBySlug;
        if (!tag) {
            // Old tags may have been saved with empty slugs — try matching by name
            const { data: tagByName } = await supabase
                .from('tags')
                .select('id')
                .eq('name', tagSlug)
                .maybeSingle();
            tag = tagByName;
        }

        if (!tag) {
            return res.status(404).json({ error: "Tag not found" });
        }

        // 2. Get creation IDs for this tag
        const { data: creationTags, error: ctError } = await supabase
            .from('creation_tags')
            .select('creation_id')
            .eq('tag_id', tag.id);

        if (ctError) throw ctError;

        const creationIds = creationTags?.map((ct: any) => ct.creation_id) || [];
        if (creationIds.length === 0) return res.json([]);

        // 3. Fetch full creations directly (efficient)
        const { data: creations, error: creationsError } = await supabase
            .from('creations')
            .select(`
                *,
                stories(content, purpose, education_category, duration_mins, age, child_name, gender, language, metadata),
                lessons(content, topic, level, tone, duration_mins, language)
            `)
            .in('id', creationIds)
            .eq('visibility', 'public');

        if (creationsError) throw creationsError;

        let results = creations || [];

        // Filter by language
        if (lang && typeof lang === 'string') {
            results = results.filter((c: any) => {
                const detail = c.stories || c.lessons;
                return detail && detail.language === lang;
            });
        }

        // 4. Batch-fetch tags
        const creationsWithTags = await mapCreationsWithTags(results);

        res.json(creationsWithTags);
    } catch (error) {
        handleApiError(res, error, "Tag discovery");
    }
});

// --- User Portfolio & Favorites ---

const userRoutes = Router();

// Get current user's library (creations owned by them)
userRoutes.get("/library", authenticateJWT, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { data, error } = await supabase
            .from('creations')
            .select(`
                *,
                stories(content, purpose, education_category, duration_mins, age, child_name, gender, language, metadata),
                lessons(content, topic, level, tone, duration_mins, language)
            `)
            .eq('owner_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const creationsWithTags = await mapCreationsWithTags(data || []);

        res.json(creationsWithTags);
    } catch (error) {
        handleApiError(res, error, "Library retrieval");
    }
});

// Get current user's favorites
userRoutes.get("/favorites", authenticateJWT, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { data: favoriteRelations, error: favError } = await supabase
            .from('favorites')
            .select('creation_id')
            .eq('user_id', userId);

        if (favError) throw favError;

        const creationIds = favoriteRelations?.map((f: any) => f.creation_id) || [];

        if (creationIds.length === 0) {
            return res.json([]);
        }

        const { data, error } = await supabase
            .from('creations')
            .select(`
                *,
                stories(content, purpose, education_category, duration_mins, age, child_name, gender, language, metadata),
                lessons(content, topic, level, tone, duration_mins, language)
            `)
            .in('id', creationIds)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const creationsWithTags = await mapCreationsWithTags(data || []);

        res.json(creationsWithTags);
    } catch (error) {
        handleApiError(res, error, "Favorites retrieval");
    }
});

// Toggle favorite status
userRoutes.post("/favorites/:id", authenticateJWT, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        const creationId = req.params.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Check if already favorited
        const { data: existing, error: checkError } = await supabase
            .from('favorites')
            .select('*')
            .eq('user_id', userId)
            .eq('creation_id', creationId)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
            // Unfavorite
            const { error: deleteError } = await supabase
                .from('favorites')
                .delete()
                .eq('user_id', userId)
                .eq('creation_id', creationId);

            if (deleteError) throw deleteError;
            res.json({ favorited: false });
        } else {
            // Favorite
            const { error: insertError } = await supabase
                .from('favorites')
                .insert({
                    user_id: userId,
                    creation_id: creationId
                });

            if (insertError) throw insertError;
            res.json({ favorited: true });
        }
    } catch (error) {
        handleApiError(res, error, "Toggle favorite");
    }
});

// --- Hero Profiles ---

const HeroProfileSchema = z.object({
    id: z.string().uuid(),
    childName: z.string().max(100),
    gender: z.enum(["male", "female", "unspecified"]),
    age: z.number().min(0).max(18).nullable(),
    siblingNames: z.array(z.object({
        name: z.string().max(100),
        gender: z.enum(["male", "female", "unspecified"]),
    })).max(10),
    pets: z.array(z.object({
        name: z.string().max(100),
        type: z.string().max(100),
    })).max(10),
    parentNames: z.array(z.object({
        name: z.string().max(100),
        gender: z.enum(["male", "female", "unspecified"]),
    })).max(10),
    language: z.string().max(10),
});

// GET /api/me/hero-profiles
userRoutes.get("/hero-profiles", authenticateJWT, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { data, error } = await supabase
            .from("profiles")
            .select("hero_profiles")
            .eq("id", userId)
            .single();

        if (error) throw error;

        res.json({ heroProfiles: data?.hero_profiles ?? [] });
    } catch (error) {
        handleApiError(res, error, "Hero profiles retrieval");
    }
});

// PUT /api/me/hero-profiles
userRoutes.put("/hero-profiles", authenticateJWT, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { heroProfiles } = z.object({
            heroProfiles: z.array(HeroProfileSchema).max(20),
        }).parse(req.body);

        const { error } = await supabase
            .from("profiles")
            .update({ hero_profiles: heroProfiles, updated_at: new Date().toISOString() })
            .eq("id", userId);

        if (error) throw error;

        res.json({ heroProfiles });
    } catch (error) {
        handleApiError(res, error, "Hero profiles save");
    }
});

// --- Rating ---

discoveryRoutes.post("/creations/:id/rate", async (req, res) => {
    try {
        const { id } = req.params;
        const { rating } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5" });
        }

        // Fetch current rating
        const { data: creation, error: fetchError } = await supabase
            .from('creations')
            .select('rating_avg, rating_count')
            .eq('id', id)
            .single();

        if (fetchError || !creation) {
            return res.status(404).json({ error: "Creation not found" });
        }

        const oldAvg = creation.rating_avg || 0;
        const oldCount = creation.rating_count || 0;
        const newCount = oldCount + 1;
        const newAvg = (oldAvg * oldCount + rating) / newCount;

        const { error: updateError } = await supabase
            .from('creations')
            .update({ rating_avg: newAvg, rating_count: newCount })
            .eq('id', id);

        if (updateError) throw updateError;

        const displayAvg = Math.round(newAvg * 10) / 10;
        console.log(`[Rating] ${id}: ${oldAvg} (${oldCount}) -> ${newAvg} (${newCount})`);
        res.json({ rating: displayAvg, ratingsCount: newCount });
    } catch (error) {
        handleApiError(res, error, "Rate creation");
    }
});

export { discoveryRoutes, userRoutes };
