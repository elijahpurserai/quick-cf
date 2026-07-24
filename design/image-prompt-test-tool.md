# Image Prompt Test Tool — Design

## Goal
Admin tool to A/B test image generation configuration changes. Picks 10 existing stories, generates new images with modified settings, and shows a side-by-side comparison against the current images — without saving anything.

## User Flow
1. Admin navigates to `/image-test` from the Admin dropdown.
2. Page loads 10 stories that already have images and stored `imagePrompt` metadata.
3. Admin sees a **Settings Panel** at the top where they can tweak:
   - Image model (dall-e-3 default)
   - Size (`1792x1024`, `1024x1024`, `1024x1792`)
   - Quality (`standard`, `hd`)
   - Style (`vivid`, `natural`)
   - Custom prompt wrapper/template (optional override around the stored `imagePrompt`)
4. Admin clicks **"Run Test"**.
5. Images generate one-by-one with streaming progress (SSE). Each result appears as a card:
   - Story title
   - Short description
   - Current image + its dimensions (from stored URL)
   - New image + its dimensions (from DALL-E temp URL)
6. Nothing is saved to DB or storage.

## Backend

### `GET /api/admin/image-test-stories`
- Auth: JWT + requireAdmin
- Fetches 10 random stories from `creations` + `stories` that have:
  - `image_url IS NOT NULL`
  - `metadata->imagePrompt IS NOT NULL` and non-empty
- Returns: `{ stories: [{ id, title, description, imageUrl, imagePrompt }] }`

### `POST /api/admin/image-test-generate`  (SSE stream)
- Auth: JWT + requireAdmin
- Body: `{ storyIds: string[], settings: { model, size, quality, style, promptTemplate? } }`
- For each story:
  - Build final prompt from stored `imagePrompt` (or wrap with `promptTemplate` if provided)
  - Call OpenAI image generation with the provided settings
  - Stream SSE event: `{ storyId, tempImageUrl, revisedPrompt? }`
- Does NOT save to DB or storage.

## Frontend — `ImageTestPage.tsx`

### Settings Panel
Editable fields for model, size, quality, style. Optional textarea for a custom prompt template where `{imagePrompt}` is the placeholder for the original stored prompt.

### Results Grid
Card per story with two columns: **Current** vs **New**.
Each column shows the image and its natural dimensions (read via `Image` JS object).

### State
- `stories[]` — loaded on mount
- `settings` — user-configured generation params
- `results` — map of storyId → { tempImageUrl, currentDimensions, newDimensions }
- `running` — boolean for in-progress state

## Route & Nav
- Route: `/image-test` → `ImageTestPage`
- Header: add to admin dropdown with `ImageIcon` and `header.imageTest` translation key

## Translations
- `header.imageTest` — "Image Test" / "בדיקת תמונות"
- `imageTest.*` namespace for all UI strings
