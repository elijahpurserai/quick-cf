import { Router, Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import { authenticateJWT } from "./auth";
import { supabase } from "./supabase";
import { APPROVED_EMAILS, IMAGE_MODEL, IMAGE_SIZE, IMAGE_QUALITY, IMAGE_STYLE } from "./config";
import { IMAGE_PROMPT_TEMPLATE, getPromptSections } from "./prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface AuthRequest extends Request {
    user?: any;
}

// Middleware: require approved email
const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    const email = req.user?.email;
    if (!email || !APPROVED_EMAILS.includes(email)) {
        return res.status(403).json({ error: "Forbidden" });
    }
    next();
};

export const adminRoutes = Router();

adminRoutes.get("/analytics", authenticateJWT, requireAdmin, async (_req, res) => {
    try {
        // 1. Total counts
        const [
            { count: totalStories },
            { count: totalLessons },
            { count: totalUsers },
        ] = await Promise.all([
            supabase.from("creations").select("*", { count: "exact", head: true }).eq("type", "story"),
            supabase.from("creations").select("*", { count: "exact", head: true }).eq("type", "lesson"),
            supabase.from("profiles").select("*", { count: "exact", head: true }),
        ]);

        // 2. Per-user stats: fetch all profiles, then aggregate creations per owner
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, email, full_name, avatar_url")
            .order("full_name", { ascending: true });

        const { data: creations } = await supabase
            .from("creations")
            .select("owner_id, type, created_at")
            .not("owner_id", "is", null);

        // Build per-user map
        const userMap = new Map<string, {
            storyCount: number;
            lessonCount: number;
            latestStoryAt: string | null;
        }>();

        for (const c of creations || []) {
            let entry = userMap.get(c.owner_id);
            if (!entry) {
                entry = { storyCount: 0, lessonCount: 0, latestStoryAt: null };
                userMap.set(c.owner_id, entry);
            }
            if (c.type === "story") {
                entry.storyCount++;
                if (!entry.latestStoryAt || c.created_at > entry.latestStoryAt) {
                    entry.latestStoryAt = c.created_at;
                }
            } else if (c.type === "lesson") {
                entry.lessonCount++;
            }
        }

        const users = (profiles || []).map((p) => {
            const stats = userMap.get(p.id) || { storyCount: 0, lessonCount: 0, latestStoryAt: null };
            return {
                id: p.id,
                email: p.email,
                name: p.full_name,
                avatar: p.avatar_url,
                storyCount: stats.storyCount,
                lessonCount: stats.lessonCount,
                latestStoryAt: stats.latestStoryAt,
            };
        });

        // 3. Anonymous stats (owner_id IS NULL)
        const { data: anonCreations } = await supabase
            .from("creations")
            .select("type, created_at")
            .is("owner_id", null);

        let anonStories = 0;
        let anonLessons = 0;
        let anonLatestStoryAt: string | null = null;

        for (const c of anonCreations || []) {
            if (c.type === "story") {
                anonStories++;
                if (!anonLatestStoryAt || c.created_at > anonLatestStoryAt) {
                    anonLatestStoryAt = c.created_at;
                }
            } else if (c.type === "lesson") {
                anonLessons++;
            }
        }

        res.json({
            totals: {
                stories: totalStories || 0,
                lessons: totalLessons || 0,
                users: totalUsers || 0,
            },
            users,
            anonymous: {
                storyCount: anonStories,
                lessonCount: anonLessons,
                latestStoryAt: anonLatestStoryAt,
            },
        });
    } catch (error) {
        console.error("[Admin] Analytics error:", error);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

// --- Delete a creation (story or lesson) and its associated data ---

adminRoutes.delete("/creations/:id", authenticateJWT, requireAdmin, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
        // 1. Fetch the creation to know its type and image
        const { data: creation, error: fetchError } = await supabase
            .from("creations")
            .select("id, type, image_url")
            .eq("id", id)
            .single();

        if (fetchError || !creation) {
            return res.status(404).json({ error: "Creation not found" });
        }

        // 2. Delete related rows (order matters for FK constraints)
        await supabase.from("creation_tags").delete().eq("creation_id", id);
        await supabase.from("favorites").delete().eq("creation_id", id);

        // 3. Delete type-specific detail row
        if (creation.type === "story") {
            await supabase.from("stories").delete().eq("id", id);
        } else if (creation.type === "lesson") {
            await supabase.from("lessons").delete().eq("id", id);
        }

        // 4. Delete the creation itself
        const { error: deleteError } = await supabase
            .from("creations")
            .delete()
            .eq("id", id);

        if (deleteError) throw deleteError;

        // 5. Remove image from storage (best-effort)
        if (creation.image_url) {
            try {
                // Image path pattern: creations/{creationId}/{timestamp}.png
                const { data: files } = await supabase.storage
                    .from("creations")
                    .list(String(id));

                if (files && files.length > 0) {
                    const paths = files.map((f: any) => `${id}/${f.name}`);
                    await supabase.storage.from("creations").remove(paths);
                    console.log(`[Admin] Removed ${paths.length} storage file(s) for ${id}`);
                }
            } catch (storageErr) {
                console.warn("[Admin] Storage cleanup failed (non-fatal):", storageErr);
            }
        }

        console.log(`[Admin] Deleted creation ${id} (${creation.type}) by ${req.user?.email}`);
        res.json({ success: true, id, type: creation.type });
    } catch (error) {
        console.error("[Admin] Delete error:", error);
        res.status(500).json({ error: "Failed to delete creation" });
    }
});

// =============================================================================
// Prompt Sections API (used by PromptsPage — single source of truth)
// =============================================================================

adminRoutes.get("/prompt-sections", authenticateJWT, requireAdmin, (_req, res) => {
    try {
        res.json(getPromptSections());
    } catch (error) {
        console.error("[Admin] Prompt sections error:", error);
        res.status(500).json({ error: "Failed to fetch prompt sections" });
    }
});

// =============================================================================
// Image Prompt Test Tool
// =============================================================================

// Use the shared IMAGE_PROMPT_TEMPLATE from prompts.ts (single source of truth)

// --- Fetch stories with images for testing ---
// Includes stories with imagePrompt in metadata, falling back to description for
// stories that have an image but no stored imagePrompt.
adminRoutes.get("/image-test-stories", authenticateJWT, requireAdmin, async (_req, res) => {
    try {
        // Fetch stories that have image_url set
        const { data: creations, error: creationsError } = await supabase
            .from("creations")
            .select("id, title, description, image_url")
            .eq("type", "story")
            .not("image_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(100);

        if (creationsError) throw creationsError;
        if (!creations || creations.length === 0) {
            return res.json({ stories: [] });
        }

        // Fetch metadata (imagePrompt) from stories table for these IDs
        const ids = creations.map((c) => c.id);
        const { data: storiesData, error: storiesError } = await supabase
            .from("stories")
            .select("id, metadata")
            .in("id", ids);

        if (storiesError) throw storiesError;

        const metaMap = new Map<string, string>();
        for (const s of storiesData || []) {
            if (s.metadata?.imagePrompt) {
                metaMap.set(s.id, s.metadata.imagePrompt);
            }
        }

        // Take up to 10 stories. Prefer those with imagePrompt, fallback to description.
        const stories = creations
            .slice(0, 10)
            .map((c) => ({
                id: c.id,
                title: c.title,
                description: c.description,
                imageUrl: c.image_url,
                imagePrompt: metaMap.get(c.id) || c.description || c.title,
                hasOriginalPrompt: metaMap.has(c.id),
            }));

        res.json({
            stories,
            fallbackPromptTemplate: IMAGE_PROMPT_TEMPLATE,
            currentSettings: { model: IMAGE_MODEL, size: IMAGE_SIZE, quality: IMAGE_QUALITY, style: IMAGE_STYLE },
        });
    } catch (error) {
        console.error("[Admin] Image test stories error:", error);
        res.status(500).json({ error: "Failed to fetch test stories" });
    }
});

// --- Generate test images (all in parallel, SSE stream for results) ---
adminRoutes.post("/image-test-generate", authenticateJWT, requireAdmin, async (req: AuthRequest, res) => {
    const { stories, settings } = req.body as {
        stories: { id: string; imagePrompt: string }[];
        settings: {
            model?: string;
            size?: string;
            quality?: string;
            style?: string;
            promptTemplate?: string;
        };
    };

    if (!stories || !Array.isArray(stories) || stories.length === 0) {
        return res.status(400).json({ error: "stories array is required" });
    }

    // SSE setup
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const model = settings?.model || IMAGE_MODEL;
    const size = (settings?.size || IMAGE_SIZE) as any;
    const quality = (settings?.quality || IMAGE_QUALITY) as any;
    const style = (settings?.style || IMAGE_STYLE) as any;
    const promptTemplate = settings?.promptTemplate || "";

    sendEvent("start", { total: stories.length, settings: { model, size, quality, style } });

    // Build prompt for a story
    const buildPrompt = (imagePrompt: string): string => {
        if (promptTemplate && promptTemplate.includes("{imagePrompt}")) {
            return promptTemplate.replace("{imagePrompt}", imagePrompt);
        } else if (promptTemplate) {
            return promptTemplate + "\n\n" + imagePrompt;
        }
        return imagePrompt;
    };

    // Helper to get file size from a URL (HEAD or GET first bytes)
    const getImageSizeBytes = async (url: string): Promise<number | null> => {
        try {
            const headRes = await fetch(url, { method: "HEAD" });
            const cl = headRes.headers.get("content-length");
            if (cl) return parseInt(cl, 10);
            // Fallback: download and measure
            const getRes = await fetch(url);
            const blob = await getRes.arrayBuffer();
            return blob.byteLength;
        } catch {
            return null;
        }
    };

    // Sharp compression pipeline — mirrors production (routes.ts / generator.ts)
    const compressWithSharp = async (imageUrl: string): Promise<{ compressedBytes: number; rawBytes: number } | null> => {
        try {
            const sharp = require('sharp');
            const MAX_IMAGE_SIZE = 500 * 1024; // 500KB

            const imgResponse = await fetch(imageUrl);
            if (!imgResponse.ok) return null;
            const arrayBuffer = await imgResponse.arrayBuffer();
            const rawBuffer = Buffer.from(arrayBuffer);
            const rawBytes = rawBuffer.length;

            let buffer = await sharp(rawBuffer)
                .resize({ width: 1200, withoutEnlargement: true })
                .webp({ quality: 80, effort: 6 })
                .toBuffer();

            // Safety net: if still too large, compress harder
            if (buffer.length > MAX_IMAGE_SIZE) {
                buffer = await sharp(buffer)
                    .webp({ quality: 55, effort: 6 })
                    .toBuffer();
            }

            return { compressedBytes: buffer.length, rawBytes };
        } catch (err: any) {
            console.error("[ImageTest] Sharp compression failed:", err.message);
            return null;
        }
    };

    // Fire all generation requests in parallel
    const promises = stories.map(async (story, i) => {
        const finalPrompt = buildPrompt(story.imagePrompt);
        const startTime = Date.now();

        try {
            console.log(`[ImageTest] Starting generation for story ${story.id} (${i + 1}/${stories.length})`);

            const response = await openai.images.generate({
                model,
                prompt: finalPrompt,
                n: 1,
                size,
                quality,
            });

            const durationMs = Date.now() - startTime;
            const tempImageUrl = response.data?.[0]?.url;
            const revisedPrompt = response.data?.[0]?.revised_prompt;

            // Run through same Sharp pipeline as production to get realistic sizes
            let newImageBytes: number | null = null;
            let compressedImageBytes: number | null = null;
            if (tempImageUrl) {
                const compressionResult = await compressWithSharp(tempImageUrl);
                if (compressionResult) {
                    newImageBytes = compressionResult.rawBytes;
                    compressedImageBytes = compressionResult.compressedBytes;
                } else {
                    // Fallback: just measure raw size
                    newImageBytes = await getImageSizeBytes(tempImageUrl);
                }
            }

            sendEvent("result", {
                index: i,
                storyId: story.id,
                tempImageUrl: tempImageUrl || null,
                revisedPrompt: revisedPrompt || null,
                finalPrompt,
                durationMs,
                newImageBytes,
                compressedImageBytes,
            });
        } catch (err: any) {
            const durationMs = Date.now() - startTime;
            console.error(`[ImageTest] Error for story ${story.id}:`, err.message);
            sendEvent("error", {
                index: i,
                storyId: story.id,
                error: err.message || "Image generation failed",
                durationMs,
            });
        }
    });

    await Promise.all(promises);

    sendEvent("done", { total: stories.length });
    res.end();
});
