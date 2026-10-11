// =============================================================================
// Server Configuration
// Edit values here to change behavior across the entire backend.
// =============================================================================

// --- AI Models ---
export const OPENAI_MODEL = "gpt-4o-mini";

// DALL·E 3 was deprecated/removed by OpenAI ("model 'dall-e-3' does not exist"), so image
// generation uses gpt-image-1. Note gpt-image-1 differs from dall-e-3:
//   - sizes: 1024x1024 | 1536x1024 (landscape) | 1024x1536 (portrait) | auto  (NOT 1792x1024)
//   - quality: low | medium | high | auto  (NOT standard | hd)
//   - it does NOT support `style`, and it returns base64 (b64_json), not a URL.
export const IMAGE_MODEL = "gpt-image-1";
export const IMAGE_SIZE: "1024x1024" | "1536x1024" | "1024x1536" | "auto" = "1536x1024";
export const IMAGE_QUALITY: "low" | "medium" | "high" | "auto" = "medium";
// Kept only so the admin image-prompt-test-tool settings panel still renders; not sent to gpt-image-1.
export const IMAGE_STYLE: "vivid" | "natural" = "vivid";

export const TTS_MODEL = "tts-1";
export const TTS_DEFAULT_VOICE = "shimmer";

// --- Access Control ---
export const APPROVED_EMAILS = ["elijah@purserai.com", "adi@purserai.com"];

// --- Content Generation ---

/** Default number of prompt suggestions requested by the batch tool */
export const SUGGESTION_COUNT = 100;

/**
 * Ideas requested per model call.
 *
 * Asking a single call for 100+ items reliably under-delivers — a request for 100
 * came back with roughly 50. The model is dependable at this size, so larger totals
 * are split into several calls of this size and merged.
 */
export const SUGGESTION_CHUNK_SIZE = 50;

/** Upper bound on the total ideas one suggest request may ask for. */
export const MAX_SUGGESTION_COUNT = 500;

/** How many suggestion chunk calls run at once. */
export const SUGGESTION_CHUNK_CONCURRENCY = 6;

/** Number of parallel content generations in the batch tool */
export const BATCH_CONCURRENCY = 20;

/** Default story duration in minutes (used for seed stories) */
export const DEFAULT_STORY_DURATION = 7;

/** Default lesson duration in minutes (used for seed lessons) */
export const DEFAULT_LESSON_DURATION = 10;

// --- Education Categories (server-side copy for prompts) ---
// --- Languages (server-side copy of the frontend's SUPPORTED_LANGUAGES) ---
// Used to name the target language in prompts. Keep in sync with
// website/src/app/config.ts SUPPORTED_LANGUAGES.
export const LANGUAGE_NAMES: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
    ar: "Arabic",
    he: "Hebrew",
};

export const EDUCATION_CATEGORIES = [
    "Emotional Intelligence",
    "Sharing",
    "Confidence",
    "Dealing with Fear",
    "Potty Training",
    "First Day of School",
    "Bullying",
    "Losing a Tooth",
    "Bedtime Anxiety",
    "Healthy Eating",
    "General Educational",
];
