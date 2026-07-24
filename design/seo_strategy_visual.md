# QuickStory.AI — SEO Strategy Visual Guide

Visual companion to [seo_strategy.md](file:///home/guy_kashtan/quick/design/seo_strategy.md).

---

## Strategy Roadmap

![SEO Strategy Roadmap — Current State, Critical Gaps, and Growth Opportunities](/home/guy_kashtan/.gemini/antigravity/brain/636421bb-35d9-4cc6-a3d4-e141402f3526/seo_strategy_overview_1771862579449.png)

---

## Implementation Priority Matrix

![SEO Priority Matrix — Impact vs Effort for all planned improvements](/home/guy_kashtan/.gemini/antigravity/brain/636421bb-35d9-4cc6-a3d4-e141402f3526/seo_priority_matrix_1771862423682.png)

---

## Current SEO Architecture

```mermaid
graph TD
    subgraph "✅ Implemented"
        A["seo.ts<br/>Meta Tags Utility"] --> B["updateMetaTags()"]
        B --> B1["document.title"]
        B --> B2["meta description"]
        B --> B3["og:title / og:description"]
        B --> B4["twitter:card / twitter:title"]
        B --> B5["canonical URL"]
        B --> B6["expanded keywords"]

        C["seo_prerender.ts<br/>Bot Middleware"] --> C1["35+ Bot Detection"]
        C1 --> C2["Full HTML + Meta<br/>for /story/:slug"]
        C1 --> C3["Full HTML + Meta<br/>for /lesson/:slug"]

        D["URL Slugs"] --> D1["kebab-case-title-shortId"]
        E["Tag Pages"] --> E1["/tag/:tagSlug"]
        F["Visual Sitemap"] --> F1["SitemapPage.tsx"]
        F --> F2["SitemapIndexPage.tsx"]
    end

    subgraph "⚠️ Missing"
        style G fill:#cc3300,color:#fff
        style H fill:#cc3300,color:#fff
        style I fill:#cc3300,color:#fff
        style J fill:#cc3300,color:#fff
        G["sitemap.xml"]
        H["og:image / twitter:image"]
        I["Schema.org JSON-LD"]
        J["robots.txt production URL"]
    end
```

---

## Multi-Language URL Architecture

```mermaid
graph TD
    ROOT["🌐 quickstory.ai"] --> EN["🇬🇧 /en/"]
    ROOT --> HE["🇮🇱 /he/"]
    ROOT --> ES["🇪🇸 /es/"]

    EN --> EN1["/en/story/brave-dragon-x5y2"]
    EN --> EN2["/en/lesson/solar-system-a1b2"]
    EN --> EN3["/en/tag/adventure"]
    EN --> EN4["/en/stories/age-4/bedtime"]

    HE --> HE1["/he/story/brave-dragon-x5y2"]
    HE --> HE2["/he/lesson/solar-system-a1b2"]
    HE --> HE3["/he/tag/adventure"]

    ES --> ES1["/es/story/brave-dragon-x5y2"]
    ES --> ES2["/es/lesson/solar-system-a1b2"]

    EN1 -. "hreflang" .-> HE1
    EN1 -. "hreflang" .-> ES1
    HE1 -. "hreflang" .-> ES1

    EN2 -. "hreflang" .-> HE2
    EN2 -. "hreflang" .-> ES2
```

> [!NOTE]
> Slugs are always derived from `englishTitle` for URL safety across all locales. The `<title>` and `<h1>` display the localized title.

---

## Long-Tail SEO Page Architecture

```mermaid
graph LR
    subgraph "Programmatic Landing Pages"
        LP1["/stories/age-4/adventure"]
        LP2["/stories/age-5/bedtime"]
        LP3["/lessons/science/preschool"]
        LP4["/stories/tag/dragons/age-6"]
    end

    subgraph "Individual Content"
        S1["Story: The Brave Dragon"]
        S2["Story: Bedtime in Space"]
        L1["Lesson: Solar System"]
    end

    subgraph "Discovery Pages"
        T1["/tag/adventure"]
        T2["/tag/dragons"]
        C1["/category/bedtime"]
        TOP["/top-stories"]
    end

    subgraph "Blog Hub"
        B1["Best Bedtime Stories<br/>for Toddlers"]
        B2["Teaching Kids About<br/>Sharing Through Stories"]
    end

    LP1 --> S1
    LP2 --> S2
    LP3 --> L1
    T1 --> S1
    T2 --> S1
    C1 --> S2
    B1 --> S2
    B1 --> LP2
    B2 --> T1
    S1 --> T1
    S1 --> T2
    TOP --> S1
    TOP --> S2
```

---

## Content Enrichment Flow

```mermaid
flowchart LR
    GEN["AI Generates<br/>Story/Lesson"] --> SLUG["Generate Slug<br/>(englishTitle + ID)"]
    SLUG --> META["Auto-set Meta Tags<br/>title, desc, OG"]
    META --> SCHEMA["Inject JSON-LD<br/>CreativeWork / Course"]
    SCHEMA --> SITEMAP["Add to sitemap.xml"]
    SITEMAP --> INDEX["Internal Links<br/>Tag Pages, Related Content"]

    style GEN fill:#7c3aed,color:#fff
    style SLUG fill:#6366f1,color:#fff
    style META fill:#3b82f6,color:#fff
    style SCHEMA fill:#0ea5e9,color:#fff
    style SITEMAP fill:#14b8a6,color:#fff
    style INDEX fill:#22c55e,color:#fff
```
