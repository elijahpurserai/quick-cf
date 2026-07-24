# Design Document: Creations URL Slugs

## 1. Problem Statement
Currently, URLs for **Creations** (Stories and Lessons) use long, non-descriptive UUIDs (e.g., `/story/af566cd0-16b6-443e-96a1-f8547d463c0f`). These are:
- Difficult for users to read and share.
- Not optimized for Search Engine Optimization (SEO).
- Hard to remember.

## 2. Proposed Solution
Implement **SEO-friendly Slugs** that incorporate the title of the Creation followed by a short unique identifier.

### Recommended Format
`[kebab-case-title]-[short-id]`

**Examples:**
- **Story**: `/story/the-magic-forest-x5y2`
- **Lesson**: `/lesson/quantum-physics-simplified-a1b2`

## 3. Slug Generation Strategy
1.  **English Title Retrieval**: The AI will be prompted to always provide an English version of the title (`englishTitle`), regardless of the content's language.
2.  **Normalization**: Convert the **English title** to lowercase.
3.  **Kebab-case**: Replace spaces and special characters with hyphens.
4.  **Unique Suffix**: Append a 4-6 character alphanumeric suffix (randomly generated) to ensure uniqueness.
5.  **Language Support**: For non-Latin titles (e.g., Hebrew), the slug will be built using the AI-provided `englishTitle` to ensure it remains URL-friendly and SEO-optimized across all locales.

## 4. Implementation Plan

### Data Model Changes
- Add a `slug` field to the `Story` and `Lesson` interfaces.
- Slugs should be stored in the database (or the mock data structure) upon creation.

### Backend Updates (`server/routes.ts`)
- Update AI system prompts for both Stories and Lessons to include an `englishTitle` field in the JSON response.
- Implement a `generateSlug(englishTitle: string)` utility function.
- Generate and save the `slug` when a new Creation is generated.

### Frontend Updates
- **API**: Update the API service to support fetching content by `slug` instead of (or in addition to) `id`.
- **Routing**: Update `routes.tsx` to handle slug-based parameters.
- **Navigation**: Update components (`StoryCard`, `LessonCard`, etc.) to use the `slug` for linking.
- **SEO**: Update `seo.ts` to ensure the canonical URL and meta tags use the slug.

## 5. Benefits
- **Better UX**: Meaningful links that tell the user what to expect.
- **Improved SEO**: Keywords in the URL help with search engine rankings.
- **Shareability**: Cleaner, more professional-looking links for social media.
