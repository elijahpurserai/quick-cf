import { Story } from "../types";

const DEFAULT_OG_IMAGE = "/images/og-default.png";

/**
 * Convert a Supabase Storage public URL into an on-the-fly transformed URL
 * sized for OG/social previews (1200×630).
 */
function toOgImageUrl(imageUrl: string): string {
  if (!imageUrl || !imageUrl.includes('/storage/v1/object/')) return imageUrl;
  return imageUrl
    .replace('/storage/v1/object/', '/storage/v1/render/image/')
    + '?width=1200&height=630&resize=cover&quality=20&format=origin';
}

/** Languages that have full UI translations */
const UI_LANGS = ["en", "he"];

export type MetaType = "story" | "lesson" | "tag" | "home" | "library" | "favorites";

export function updateMetaTags(
  storyOrTitle: any,
  description?: string,
  tags: string[] = [],
  type?: MetaType
) {
  let title: string;
  let ogTitle: string; // English title for OG/social meta tags
  let desc: string;
  let keywords: any[] = [];
  let finalTitle: string;
  let imageUrl: string = DEFAULT_OG_IMAGE;

  if (typeof storyOrTitle === "object" && storyOrTitle !== null) {
    // Use native-language title for the page title (SEO in the story's language)
    title = storyOrTitle.title || storyOrTitle.topic || "Content";
    // Use native-language title for OG/social meta tags too
    ogTitle = title;
    desc = storyOrTitle.description || "";
    keywords = storyOrTitle.tags || [];
    if (storyOrTitle.imageUrl) {
      imageUrl = storyOrTitle.imageUrl;
    }

    // Auto-detect type if not provided
    if (!type) {
      if ("childName" in storyOrTitle) type = "story";
      else if ("level" in storyOrTitle) type = "lesson";
    }
  } else {
    title = storyOrTitle;
    ogTitle = title;
    desc = description || "";
    keywords = tags;
  }

  // Apply title patterns according to SEO Strategy
  switch (type) {
    case "story":
      finalTitle = `${title} | Quick Story`;
      break;
    case "lesson":
      finalTitle = `${title} | Quick Lesson`;
      break;
    case "tag":
      finalTitle = `Stories & Lessons about ${title}`;
      break;
    case "home":
      finalTitle = title; // Home title is usually passed as the full string
      break;
    case "library":
    case "favorites":
      finalTitle = `${title} | Quick`;
      break;
    default:
      finalTitle = title.includes("|") ? title : `${title} | Quick`;
  }

  // Update page title
  document.title = finalTitle;

  // Update or create meta description
  updateMetaTag("description", desc);

  // Update or create Open Graph tags
  updateMetaTag("og:title", ogTitle, "property");
  updateMetaTag("og:description", desc, "property");
  updateMetaTag("og:type", type === "story" || type === "lesson" ? "article" : "website", "property");

  // Update or create Twitter Card tags
  updateMetaTag("twitter:card", "summary_large_image");
  updateMetaTag("twitter:title", ogTitle);
  updateMetaTag("twitter:description", desc);

  // Update social preview images (use transformed URL for OG-sized previews)
  const ogImage = toOgImageUrl(imageUrl);
  updateMetaTag("og:image", ogImage, "property");
  updateMetaTag("twitter:image", ogImage);

  // Set robots directive (default to index, follow)
  updateMetaTag("robots", "index, follow");

  // Update or create keywords
  if (keywords.length > 0) {
    const expandedKeywords = new Set<string>();

    keywords.forEach(tag => {
      const tagName = typeof tag === 'string' ? tag : (tag.name || "");
      if (!tagName) return;

      const t = tagName.toLowerCase().trim();
      expandedKeywords.add(t);
      expandedKeywords.add(`${t} for children`);
      expandedKeywords.add(`${t} stories`);
      expandedKeywords.add(`${t} lessons`);

      if (type === "story") {
        expandedKeywords.add(`${t} story`);
      } else if (type === "lesson") {
        expandedKeywords.add(`${t} lesson`);
      }
    });

    updateMetaTag("keywords", Array.from(expandedKeywords).join(", "));
  }

  // Update canonical URL
  updateCanonicalTag(window.location.href);

  // Update hreflang alternates
  updateHreflangTags(window.location.pathname);
}

function updateCanonicalTag(url: string) {
  let element = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", url);
}

function updateMetaTag(
  name: string,
  content: string,
  attribute: "name" | "property" = "name"
) {
  let element = document.querySelector(
    `meta[${attribute}="${name}"]`
  ) as HTMLMetaElement;

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }

  element.content = content;
}

export function resetMetaTags(lang?: string) {
  const effectiveLang = lang || document.documentElement.lang || "en";
  if (effectiveLang === "he") {
    document.title = "QuickStory.AI - סיפורים קסומים לילדים";
    updateMetaTag(
      "description",
      "צרו סיפורים מותאמים אישית והרפתקאות חינוכיות לילדים שלכם תוך שניות עם AI."
    );
  } else {
    document.title = "QuickStory.AI - Magical Stories for Children";
    updateMetaTag(
      "description",
      "Create personalized bedtime stories and educational adventures for your children in seconds with AI."
    );
  }
  updateCanonicalTag(window.location.href);
  updateHreflangTags(window.location.pathname);
}

export function setNoIndex(noIndex: boolean = true) {
  let element = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", "robots");
    document.head.appendChild(element);
  }
  element.content = noIndex ? "noindex, nofollow" : "index, follow";
}

/**
 * Add/update hreflang alternate links for the current page.
 * Creates links for each UI language and an x-default fallback.
 */
function updateHreflangTags(currentPath: string) {
  // Remove existing hreflang links
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());

  const baseUrl = window.location.origin;
  // Strip any existing lang prefix from the path
  const pathWithoutLang = currentPath.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';

  for (const lang of UI_LANGS) {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = lang;
    link.href = `${baseUrl}/${lang}${pathWithoutLang}`;
    document.head.appendChild(link);
  }

  // x-default points to English
  const xDefault = document.createElement('link');
  xDefault.rel = 'alternate';
  xDefault.setAttribute('hreflang', 'x-default');
  xDefault.href = `${baseUrl}/en${pathWithoutLang}`;
  document.head.appendChild(xDefault);
}
