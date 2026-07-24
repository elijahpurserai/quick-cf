# Design Document: SEO Metadata Strategy

## 1. Objective
Establish a consistent and automated approach to SEO metadata (titles, descriptions, tags, and social sharing) across the Quick platform to maximize discoverability and provide high-quality search engine and social media previews.

## 2. Core Components

### 2.1 Title Pattern
All page titles follow a consistent suffix pattern:
`[Page Content Title] | Quick`

- **Home**: `QuickStory.AI - Magical Stories for Children`
- **Story**: `[Story Title] | Quick Story`
- **Lesson**: `[Lesson Topic] | Quick Lesson`
- **Tag Page**: `Stories & Lessons about [Tag Name]`

### 2.2 Meta Descriptions
Descriptions are tailored to the content type:
- **Global / Home**: "Create personalized bedtime stories and educational adventures for your children in seconds with AI."
- **Story**: Use the AI-generated `description` field or a snippet of the story content.
- **Lesson**: Use the AI-generated `description` field or a snippet of the lesson content.
- **Tag Page**: "Explore the best [Tag Name] stories and lessons for children. Personalized learning and fun for kids!" (No `#` symbol used in descriptions)

### 2.3 Tags and Keywords
- **Dynamic Keywords**: The `meta[name="keywords"]` tag is dynamically expanded from the content's `tags` array. For each tag, variations are added: `[tag]`, `[tag] for children`, `[tag] stories`, and `[tag] lessons`.
- **Content Specific Keywords**: Stories and lessons also receive `[tag] story` or `[tag] lesson` keywords respectively.
- **Tag Pages**: Tags are converted to SEO-friendly slugs (e.g., `space-exploration`) for clean URLs and better indexing.

### 2.4 Social Sharing (Open Graph & Twitter)
To ensure broad compatibility, the following tags are updated for every unique content page:
- `og:title`, `og:description`, `og:type` (set to `article` for stories/lessons).
- `twitter:card` (set to `summary_large_image`), `twitter:title`, `twitter:description`.
- `og:image` / `twitter:image`: (Planned) Use the generated `imageUrl`.

## 3. Implementation Logic

### 3.1 Utility: `seo.ts`
The central `updateMetaTags` utility handles the DOM manipulation. It accepts either a content object (Story/Lesson) or manual strings.

```typescript
export function updateMetaTags(
  storyOrTitle: any,
  description?: string,
  tags: string[] = []
) {
  // Logic to parse input and call updateMetaTag() for each field
}
```

### 3.2 Page Integration
- **Effect-Based Updates**: Each page uses a `useEffect` hook to update tags on mount and reset them on unmount.
- **Slug Integration**: Navigation always favors SEO-friendly slugs over internal UUIDs.

## 4. Page-Specific Metadata Table

| Page | Title Pattern | Description Source | Keywords Source |
| :--- | :--- | :--- | :--- |
| **Home** | Global Default | Global Default | General keywords |
| **Story** | `story.title` | `story.description` | `story.tags` |
| **Lesson** | `lesson.topic` | `lesson.description` | `lesson.tags` |
| **Tag Page** | `displayTag` | Template with `tag` | `tag` |
| **Library** | "My Library" | User library info | N/A |
| **Favorites** | "My Favorites" | User favorites info | N/A |

## 5. Future Enhancements
- **Dynamic OG Images**: Generate custom social preview images combining story art and titles.
- **Canonical Tags**: Explicitly define canonical URLs to prevent duplicate content issues.
- **Sitemap Integration**: Automatically include all generated content slugs in `sitemap.xml`.

## 6. Metadata Examples

### 6.1 Mock Story
**Content**: [The Brave Little Dragon Slayer](file:///home/guy_kashtan/quick/website/src/app/data/mockStories.ts)
- **Title**: `The Brave Little Dragon Slayer | Quick Story`
- **Description**: `A magical adventure story about a brave 4-year-old who helps a friendly dragon find her way home.`
- **Keywords**: `adventure, adventure for children, adventure stories, adventure lessons, adventure story, dragons, dragons for children, dragons stories, dragons lessons, dragons story, friendship, friendship for children, friendship stories, friendship lessons, friendship story, bravery, bravery for children, bravery stories, bravery lessons, bravery story`

### 6.2 Mock Lesson
**Content**: [The Solar System for Kids](file:///home/guy_kashtan/quick/website/src/app/data/mockLessons.ts)
- **Title**: `The Solar System for Kids | Quick Lesson`
- **Description**: `An engaging introduction to the solar system, planets, and the sun for elementary school children.`
- **Keywords**: `science, science for children, science stories, science lessons, science lesson, space, space for children, space stories, space lessons, space lesson, astronomy, astronomy for children, astronomy stories, astronomy lessons, astronomy lesson, planets, planets for children, planets stories, planets lessons, planets lesson`

### 6.3 Tag Page
**Tag**: `science`
- **Title**: `Stories & Lessons about science`
- **Description**: `Explore the best science stories and lessons for children. Personalized learning and fun for kids!`
- **Keywords**: `science, science for children, science stories, science lessons`
