// =============================================================================
// Frontend Configuration
// Edit values here to change behavior across the entire website.
// =============================================================================

// --- Site Identity ---
export const SITE_NAME = "QuickStory.AI";
export const SITE_TAGLINE = "Magical Stories for Children";
export const SITE_DESCRIPTION =
    "Create personalized bedtime stories and educational adventures for your children in seconds with AI.";
export const SEO_KEYWORDS = [
    "bedtime stories",
    "personalized stories",
    "AI stories",
    "education",
    "kids",
];

// --- Homepage ---

/** Number of top stories/lessons shown on the homepage */
export const HOMEPAGE_ITEMS_LIMIT = 6;

// --- Story Generator Form ---

export const SUPPORTED_LANGUAGES = [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
    { code: "fr", label: "Français" },
    { code: "de", label: "Deutsch" },
    { code: "it", label: "Italiano" },
    { code: "pt", label: "Português" },
    { code: "zh", label: "中文" },
    { code: "ja", label: "日本語" },
    { code: "ko", label: "한국어" },
    { code: "ar", label: "العربية" },
    { code: "he", label: "עברית (Hebrew)" },
];

export const AGE_RANGE = { min: 1, max: 120 };

/** Maximum custom duration in minutes */
export const MAX_CUSTOM_DURATION = 30;
