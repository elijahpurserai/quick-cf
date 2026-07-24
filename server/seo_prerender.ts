import { Request, Response, NextFunction } from "express";
import { supabase } from "./supabase";
import { toOgImageUrl } from "./image_utils";

const BOTS = [
    "googlebot",
    "bingbot",
    "slurp",
    "duckduckbot",
    "baiduspider",
    "yandexbot",
    "facebot",
    "facebookexternalhit",
    "twitterbot",
    "rogerbot",
    "linkedinbot",
    "embedly",
    "quora link preview",
    "showyoubot",
    "outbrain",
    "pinterest/0.",
    "slackbot",
    "vkshare",
    "w3c_validator",
    "redditbot",
    "applebot",
    "whatsapp",
    "flipboard",
    "tumblr",
    "bitlybot",
    "skypeuripreview",
    "nuzzel",
    "discordbot",
    "google pagead",
    "qwantify",
    "pinterestbot",
    "bitrix link preview",
    "xing-content-proxy",
    "telegrambot",
    "google-inspectiontool"
];

export async function seoPrerender(req: Request, res: Response, next: NextFunction) {
    const userAgent = req.headers["user-agent"]?.toLowerCase() || "";
    const isBot = BOTS.some(bot => userAgent.includes(bot));

    // Log every story/lesson request so we can diagnose bot detection
    const reqPath = req.path;
    if (reqPath.includes("/story/") || reqPath.includes("/lesson/")) {
        console.log(`[SEO] ${reqPath} | isBot=${isBot} | UA=${userAgent.slice(0, 120)}`);
    }

    if (!isBot) {
        return next();
    }

    const path = req.path;

    // Match directory pages: /all-stories, /all-lessons, /sitemap/all-stories, /sitemap/all-lessons
    const allStoriesMatch = path.match(/^\/(?:([a-z]{2})\/)?(?:sitemap\/)?all-stories$/);
    const allLessonsMatch = path.match(/^\/(?:([a-z]{2})\/)?(?:sitemap\/)?all-lessons$/);

    if (allStoriesMatch || allLessonsMatch) {
        const dirType = allStoriesMatch ? "story" : "lesson";
        const dirLang = (allStoriesMatch || allLessonsMatch)![1] || "en";
        return prerenderDirectoryPage(dirType, dirLang, req, res, next);
    }

    // Match tag/category pages: /cat/:tagSlug or /tag/:tagSlug
    const catMatch = path.match(/^\/(?:([a-z]{2})\/)?(?:cat|tag)\/([^\/]+)$/);
    if (catMatch) {
        const catLang = catMatch[1] || "en";
        const tagSlug = catMatch[2];
        return prerenderTagPage(tagSlug, catLang, req, res, next);
    }

    const storyMatch = path.match(/^\/(?:([a-z]{2})\/)?story\/([^\/]+)$/);
    const lessonMatch = path.match(/^\/(?:([a-z]{2})\/)?lesson\/([^\/]+)$/);

    if (!storyMatch && !lessonMatch) {
        return next();
    }

    const type = storyMatch ? "story" : "lesson";
    const langFromUrl = storyMatch ? storyMatch[1] : lessonMatch![1];
    const slug = storyMatch ? storyMatch[2] : lessonMatch![2];

    console.log(`[SEO] Prerendering ${type}/${slug} for bot UA`);

    try {
        // Fetch from creations table to get base info
        const { data: creation, error: creationError } = await supabase
            .from("creations")
            .select("*")
            .eq("slug", slug)
            .eq("type", type)
            .single();

        if (creationError || !creation) {
            console.warn(`[SEO] Content not found for bot: ${type}/${slug}`);
            return next();
        }

        // Non-public content should not be prerendered for bots
        if (creation.visibility !== "public") {
            console.log(`[SEO] Skipping ${creation.visibility} ${type}/${slug} — not prerendering for bots`);
            return next();
        }

        // Fetch detailed content
        const table = type === "story" ? "stories" : "lessons";
        const { data: details, error: detailsError } = await supabase
            .from(table)
            .select("*")
            .eq("id", creation.id)
            .single();

        if (detailsError || !details) {
            console.warn(`[SEO] Details not found for ${type}/${slug}: ${detailsError?.message}`);
            return next();
        }

        // Render minimal HTML
        const title = creation.title || creation.english_title;
        const description = creation.description || "";
        const content = details.content || "";
        const siteTitle = type === "story" ? "Quick Story" : "Quick Lesson";
        const clientUrl = process.env.CLIENT_URL || "https://quickstory.ai";
        const rawImageUrl = creation.image_url || `${clientUrl}/images/og-default.png`;
        const imageUrl = toOgImageUrl(rawImageUrl);

        // Determine language: URL prefix > content language > fallback 'en'
        const lang = langFromUrl || details.language || 'en';
        const isRTL = ['he', 'ar'].includes(lang);
        const dirAttr = isRTL ? ' dir="rtl"' : '';
        const langPrefix = `/${lang}`;
        const canonicalUrl = `${clientUrl}${langPrefix}/${type}/${slug}`;

        // Build hreflang links for the prerendered HTML
        const hreflangLinks = `
    <link rel="alternate" hreflang="${lang}" href="${canonicalUrl}">
    <link rel="alternate" hreflang="x-default" href="${canonicalUrl}">
    <link rel="canonical" href="${canonicalUrl}">`;

        const html = `
<!DOCTYPE html>
<html lang="${lang}"${dirAttr}>
<head>
    <meta charset="UTF-8">
    <title>${title} | ${siteTitle}</title>
    <meta name="description" content="${description}">
    ${hreflangLinks}
    
    <!-- Open Graph -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${imageUrl}">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">

    <style>
        body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
        h1 { color: #1a1a1a; }
        .content { white-space: pre-wrap; margin-top: 30px; }
        .meta { color: #666; font-size: 0.9em; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
    </style>
</head>
<body>
    <article>
        <h1>${title}</h1>
        <div class="meta">
            <p>Type: ${type.toUpperCase()}</p>
            <p>Published: ${new Date(creation.created_at).toLocaleDateString()}</p>
        </div>
        <div class="content">
            ${content}
        </div>
    </article>
</body>
</html>
        `.trim();

        console.log(`[SEO] Served prerendered HTML for ${type}/${slug} | image=${imageUrl}`);
        return res.send(html);

    } catch (err) {
        console.error(`[SEO] Error pre-rendering for bot:`, err);
        return next();
    }
}

/**
 * Pre-render a full alphabetical directory page for bots.
 * Generates a static HTML page listing all public stories or lessons as crawlable links.
 */
async function prerenderDirectoryPage(
    type: "story" | "lesson",
    lang: string,
    _req: Request,
    res: Response,
    next: NextFunction
) {
    const clientUrl = process.env.CLIENT_URL || "https://quickstory.ai";
    const isRTL = ['he', 'ar'].includes(lang);
    const dirAttr = isRTL ? ' dir="rtl"' : '';
    const langPrefix = `/${lang}`;

    const pageSlug = type === "story" ? "all-stories" : "all-lessons";
    const canonicalUrl = `${clientUrl}${langPrefix}/${pageSlug}`;
    const pageTitle = type === "story"
        ? "All Fairy Tales & Stories — Complete A-Z Directory"
        : "All Educational Lessons — Complete A-Z Directory";
    const pageDescription = type === "story"
        ? "Browse our complete alphabetical directory of personalized children's stories. Find fairy tales, bedtime stories, and adventures from A to Z."
        : "Explore our full alphabetical directory of personalized educational lessons for kids. Topics from A to Z including science, history, nature, and more.";

    try {
        const table = type === "story" ? "stories" : "lessons";
        const titleCol = type === "story" ? "title" : "topic";

        // Fetch all public creations of this type for the given language
        const { data: creations, error } = await supabase
            .from("creations")
            .select(`slug, title, english_title, description, ${table}(language, ${titleCol})`)
            .eq("type", type)
            .eq("visibility", "public")
            .order("title", { ascending: true })
            .limit(5000);

        if (error) throw error;

        // Filter by language
        const filtered = (creations || []).filter(c => {
            const detail = Array.isArray((c as any)[table]) ? (c as any)[table][0] : (c as any)[table];
            return detail && detail.language === lang;
        });

        // Sort alphabetically
        filtered.sort((a, b) => {
            const titleA = a.title || a.english_title || "";
            const titleB = b.title || b.english_title || "";
            return titleA.localeCompare(titleB, lang);
        });

        // Group by first letter
        const groups: Record<string, typeof filtered> = {};
        for (const item of filtered) {
            const title = item.title || item.english_title || "";
            const letter = title.charAt(0).toUpperCase();
            const key = /[A-Za-z\u0590-\u05FF\u0600-\u06FF]/.test(letter) ? letter : "#";
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        }

        const sortedLetters = Object.keys(groups).sort((a, b) => {
            if (a === "#") return 1;
            if (b === "#") return -1;
            return a.localeCompare(b);
        });

        // Build letter navigation
        const letterNav = sortedLetters
            .map(l => `<a href="#letter-${l}" style="display:inline-block;padding:4px 10px;margin:2px;border:1px solid #ddd;border-radius:4px;text-decoration:none;color:#333;font-weight:bold;">${l}</a>`)
            .join("\n");

        // Build link lists grouped by letter
        const sections = sortedLetters.map(letter => {
            const items = groups[letter];
            const links = items.map(item => {
                const title = item.title || item.english_title || "Untitled";
                const urlType = type === "story" ? "story" : "lesson";
                return `        <li><a href="${clientUrl}${langPrefix}/${urlType}/${item.slug}">${escapeHtml(title)}</a>${item.description ? ` — <span>${escapeHtml(item.description.substring(0, 120))}</span>` : ""}</li>`;
            }).join("\n");
            return `    <section id="letter-${letter}">
        <h2>${letter}</h2>
        <ul>
${links}
        </ul>
    </section>`;
        }).join("\n\n");

        // JSON-LD structured data (CollectionPage)
        const jsonLd = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": pageTitle,
            "description": pageDescription,
            "url": canonicalUrl,
            "numberOfItems": filtered.length,
            "hasPart": filtered.slice(0, 100).map(item => ({
                "@type": type === "story" ? "CreativeWork" : "LearningResource",
                "name": item.title || item.english_title,
                "url": `${clientUrl}${langPrefix}/${type}/${item.slug}`
            }))
        });

        // Hreflang links
        const UI_LANGS = ["en", "he"];
        const hreflangLinks = UI_LANGS
            .map(l => `    <link rel="alternate" hreflang="${l}" href="${clientUrl}/${l}/${pageSlug}">`)
            .concat(`    <link rel="alternate" hreflang="x-default" href="${clientUrl}/en/${pageSlug}">`)
            .join("\n");

        const html = `<!DOCTYPE html>
<html lang="${lang}"${dirAttr}>
<head>
    <meta charset="UTF-8">
    <title>${pageTitle} | Quick</title>
    <meta name="description" content="${pageDescription}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${canonicalUrl}">
${hreflangLinks}

    <!-- Open Graph -->
    <meta property="og:title" content="${pageTitle}">
    <meta property="og:description" content="${pageDescription}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonicalUrl}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${pageTitle}">
    <meta name="twitter:description" content="${pageDescription}">

    <!-- Structured Data -->
    <script type="application/ld+json">${jsonLd}</script>

    <style>
        body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 1000px; margin: 40px auto; padding: 20px; color: #333; }
        h1 { color: #1a1a1a; margin-bottom: 8px; }
        h2 { color: #4a4a4a; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px; }
        .subtitle { color: #666; font-size: 1.1em; margin-bottom: 24px; }
        nav { margin-bottom: 24px; }
        ul { list-style: none; padding: 0; }
        li { padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
        li a { color: #6b21a8; text-decoration: none; font-weight: 500; }
        li a:hover { text-decoration: underline; }
        li span { color: #9ca3af; font-size: 0.9em; }
        .count { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <main>
        <h1>${pageTitle}</h1>
        <p class="subtitle">${pageDescription}</p>
        <p class="count">${filtered.length} ${type === "story" ? "stories" : "lessons"} available</p>

        <nav aria-label="Alphabetical navigation">
            ${letterNav}
        </nav>

${sections}
    </main>

    <footer style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;color:#999;font-size:0.85em;">
        <a href="${clientUrl}${langPrefix}/sitemap">Sitemap</a> |
        <a href="${clientUrl}${langPrefix}/">Home</a>
    </footer>
</body>
</html>`;

        console.log(`[SEO] Served prerendered directory page: ${pageSlug} (${lang}) — ${filtered.length} items`);
        return res.send(html);
    } catch (err) {
        console.error(`[SEO] Error pre-rendering directory page:`, err);
        return next();
    }
}

/**
 * Pre-render a tag/category page for bots.
 * Generates a static HTML page listing all public stories and lessons for a given tag,
 * with proper meta tags, structured data, and crawlable links.
 */
async function prerenderTagPage(
    tagSlug: string,
    lang: string,
    _req: Request,
    res: Response,
    next: NextFunction
) {
    const clientUrl = process.env.CLIENT_URL || "https://quickstory.ai";
    const isRTL = ['he', 'ar'].includes(lang);
    const dirAttr = isRTL ? ' dir="rtl"' : '';
    const langPrefix = `/${lang}`;
    const canonicalUrl = `${clientUrl}${langPrefix}/cat/${tagSlug}`;

    try {
        // 1. Fetch the tag record
        const { data: tag, error: tagError } = await supabase
            .from("tags")
            .select("id, name, slug")
            .eq("slug", tagSlug)
            .single();

        if (tagError || !tag) {
            console.warn(`[SEO] Tag not found for bot: ${tagSlug}`);
            return next();
        }

        // 2. Fetch creation IDs for this tag
        const { data: creationTags, error: ctError } = await supabase
            .from("creation_tags")
            .select("creation_id")
            .eq("tag_id", tag.id);

        if (ctError) throw ctError;

        const creationIds = creationTags?.map((ct: any) => ct.creation_id) || [];

        // 3. Fetch full creations with details
        let stories: any[] = [];
        let lessons: any[] = [];

        if (creationIds.length > 0) {
            const { data: creations, error: creationsError } = await supabase
                .from("creations")
                .select(`
                    slug, title, english_title, description, type, image_url, created_at,
                    stories(language),
                    lessons(language)
                `)
                .in("id", creationIds)
                .eq("visibility", "public")
                .order("created_at", { ascending: false })
                .limit(200);

            if (creationsError) throw creationsError;

            // Filter by language
            const filtered = (creations || []).filter((c: any) => {
                const detail = c.stories || c.lessons;
                return detail && detail.language === lang;
            });

            stories = filtered.filter((c: any) => c.type === "story");
            lessons = filtered.filter((c: any) => c.type === "lesson");
        }

        const displayTag = tag.name || tagSlug.replace(/-/g, " ");
        const totalCount = stories.length + lessons.length;
        const pageTitle = `${displayTag} — Stories & Lessons for Kids`;
        const pageDescription = `Explore the best ${displayTag} stories and lessons for children. ${totalCount} personalized learning adventures available.`;

        // Build story links
        const storyLinks = stories.map((s: any) => {
            const title = s.title || s.english_title || "Untitled";
            return `        <li><a href="${clientUrl}${langPrefix}/story/${s.slug}">${escapeHtml(title)}</a>${s.description ? ` — <span>${escapeHtml(s.description.substring(0, 120))}</span>` : ""}</li>`;
        }).join("\n");

        // Build lesson links
        const lessonLinks = lessons.map((l: any) => {
            const title = l.title || l.english_title || "Untitled";
            return `        <li><a href="${clientUrl}${langPrefix}/lesson/${l.slug}">${escapeHtml(title)}</a>${l.description ? ` — <span>${escapeHtml(l.description.substring(0, 120))}</span>` : ""}</li>`;
        }).join("\n");

        // JSON-LD structured data
        const jsonLd = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": pageTitle,
            "description": pageDescription,
            "url": canonicalUrl,
            "numberOfItems": totalCount,
            "about": {
                "@type": "Thing",
                "name": displayTag
            },
            "hasPart": [...stories, ...lessons].slice(0, 50).map((item: any) => ({
                "@type": item.type === "story" ? "CreativeWork" : "LearningResource",
                "name": item.title || item.english_title,
                "url": `${clientUrl}${langPrefix}/${item.type}/${item.slug}`
            }))
        });

        // Hreflang links
        const UI_LANGS = ["en", "he"];
        const hreflangLinks = UI_LANGS
            .map(l => `    <link rel="alternate" hreflang="${l}" href="${clientUrl}/${l}/cat/${tagSlug}">`)
            .concat(`    <link rel="alternate" hreflang="x-default" href="${clientUrl}/en/cat/${tagSlug}">`)
            .join("\n");

        const html = `<!DOCTYPE html>
<html lang="${lang}"${dirAttr}>
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(pageTitle)} | Quick</title>
    <meta name="description" content="${escapeHtml(pageDescription)}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${canonicalUrl}">
${hreflangLinks}

    <!-- Open Graph -->
    <meta property="og:title" content="${escapeHtml(pageTitle)}">
    <meta property="og:description" content="${escapeHtml(pageDescription)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonicalUrl}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
    <meta name="twitter:description" content="${escapeHtml(pageDescription)}">

    <!-- Structured Data -->
    <script type="application/ld+json">${jsonLd}</script>

    <style>
        body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 1000px; margin: 40px auto; padding: 20px; color: #333; }
        h1 { color: #1a1a1a; margin-bottom: 8px; }
        h2 { color: #4a4a4a; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px; }
        .subtitle { color: #666; font-size: 1.1em; margin-bottom: 24px; }
        ul { list-style: none; padding: 0; }
        li { padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
        li a { color: #6b21a8; text-decoration: none; font-weight: 500; }
        li a:hover { text-decoration: underline; }
        li span { color: #9ca3af; font-size: 0.9em; }
        .count { color: #666; font-size: 0.9em; }
        .tag-badge { display: inline-block; background: #f3e8ff; color: #6b21a8; padding: 4px 12px; border-radius: 16px; font-weight: 600; margin-right: 8px; }
    </style>
</head>
<body>
    <main>
        <h1><span class="tag-badge">#${escapeHtml(displayTag)}</span> ${escapeHtml(pageTitle)}</h1>
        <p class="subtitle">${escapeHtml(pageDescription)}</p>

${stories.length > 0 ? `        <section>
            <h2>Stories (${stories.length})</h2>
            <ul>
${storyLinks}
            </ul>
        </section>` : ""}

${lessons.length > 0 ? `        <section>
            <h2>Lessons (${lessons.length})</h2>
            <ul>
${lessonLinks}
            </ul>
        </section>` : ""}

${totalCount === 0 ? `        <p>No stories or lessons found for this tag yet.</p>` : ""}
    </main>

    <footer style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;color:#999;font-size:0.85em;">
        <a href="${clientUrl}${langPrefix}/sitemap">Sitemap</a> |
        <a href="${clientUrl}${langPrefix}/">Home</a>
    </footer>
</body>
</html>`;

        console.log(`[SEO] Served prerendered tag page: ${tagSlug} (${lang}) — ${totalCount} items`);
        return res.send(html);
    } catch (err) {
        console.error(`[SEO] Error pre-rendering tag page:`, err);
        return next();
    }
}

/** Escape HTML special characters to prevent XSS in prerendered content */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
