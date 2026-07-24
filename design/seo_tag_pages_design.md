# Design Document: SEO Tag Pages

## 1. Problem Statement
Currently, **Creations** (Stories and Lessons) have tags (e.g., #science, #adventure), but these are static labels. 
- Users cannot click them to find related content.
- Search engines cannot index collections of content based on these keywords.
- Discoverability of related topics is limited.

## 2. Proposed Solution
Implement dedicated **Tag Pages** that aggregate all **Creations** (Stories and Lessons) containing a specific tag.

### URL Structure
`/tag/[tag-slug]`

**Tag Slugification**:
Tags are converted to SEO-friendly slugs by:
1. Lowercasing the tag name.
2. Trimming whitespace.
3. Replacing all spaces with a single dash (`-`).
Example: `Moral Lessons` -> `moral-lessons`

**Examples:**
- `/tag/space-exploration`
- `/tag/moral-lessons`
- `/tag/math-fun`

## 3. Implementation Plan

### Frontend Components
- **New Page**: `TagPage.tsx`
    - Displays a title (e.g., "Creations tagged with #Science").
    - Shows a grid of `StoryCard` and `LessonCard` components filtered by the tag.
    - Includes basic filtering/sorting (e.g., sort by rating, date).
- **Navigation**:
    - Update the `Tag` components in `StoryPage.tsx`, `LessonPage.tsx`, `StoryCard.tsx`, and `LessonCard.tsx` to be clickable links (`<Link to={`/tag/${tag}`}>`).

### Routing (`routes.tsx`)
- Add a new route: path `/tag/:tagSlug`, component `<TagPage />`.

### Data Management (`AppContext.tsx`)
- Extend the context or create a selector to filter `stories` and `lessons` by a given tag string.
- Since tags are case-insensitive by convention, ensure filtering handles case normalization.

### SEO Strategy
- **Meta Tags**: Dynamically set the `<title>` and `<meta description>` for each tag page (e.g., "Explore the best Adventure stories and lessons for kids").
- **Internal Linking**: Every creation page will now link back to its respective tag pages, creating a strong internal link graph.
- **Sitemap**: Tag pages should be included in the XML sitemap for search engine discovery.

## 4. Visual Design
- The header of the tag page should feel like a landing page, perhaps with a representative icon or a colorful banner matching the tag's theme.
- Use a "Creations" tab system (similar to the Library) if the number of stories vs. lessons is large.

## 5. Benefits
- **Improved UX**: Easy discovery of similar content.
- **Superior SEO**: Rank for high-volume keywords and long-tail topics.
- **Increased Engagement**: Users stay longer on the site by following "rabbit holes" of interesting tags.
