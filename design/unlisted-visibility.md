# Design: Unlisted Visibility Option

## Overview

Add a third visibility option — **Unlisted** — alongside the existing Public and Private modes. An unlisted Creation doesn't appear in Discovery, tag pages, or the sitemap, but anyone with the direct link can view it. This is ideal for sharing with specific people without making content fully public.

## Visibility Matrix

| Behavior | Public | Unlisted | Private |
|---|---|---|---|
| Appears in Discovery / trending | Yes | No | No |
| Appears in tag pages | Yes | No | No |
| Included in sitemap | Yes | No | No |
| Accessible via direct link (anyone) | Yes | Yes | No |
| Accessible via direct link (owner only) | Yes | Yes | Yes |
| Appears in owner's Library | Yes | Yes | Yes |
| SEO indexed (meta robots) | Yes | No (noindex) | No (noindex) |
| Requires authentication to create | No | No | Yes |

## Data Model Changes

### Database: `creations` table

Replace the `is_public` boolean column with a text `visibility` column:

```
visibility TEXT NOT NULL DEFAULT 'public'
  -- values: 'public' | 'unlisted' | 'private'
```

**Migration strategy:**
- Add the new `visibility` column with default `'public'`
- Backfill: `is_public = true` → `'public'`, `is_public = false` → `'private'`
- Drop `is_public` column after backfill is confirmed

### TypeScript Types (`types.ts`)

```ts
// New union type
export type Visibility = "public" | "unlisted" | "private";

// Replace isPublic on Story & Lesson
visibility?: Visibility;   // replaces isPublic?: boolean

// Replace isPrivate on StoryFormData & LessonFormData
visibility?: Visibility;   // replaces isPrivate?: boolean
// Default: "public"
```

### Zod Schemas (`routes.ts`)

```ts
visibility: z.enum(["public", "unlisted", "private"]).optional().default("public"),
// replaces: isPrivate: z.boolean().optional().default(false)
```

## Server-Side Changes (`routes.ts`)

### 1. Creation mapping helper (`mapCreation`)

```ts
// Replace:  isPublic: creation.is_public
// With:     visibility: creation.visibility
```

### 2. Generation endpoints (story + lesson insert)

```ts
// Replace:  is_public: !formData.isPrivate
// With:     visibility: formData.visibility ?? "public"
```

### 3. Access control (story + lesson retrieval)

```ts
// Current:
if (!creation.is_public && creation.owner_id !== userId) { return 403; }

// New:
if (creation.visibility === "private" && creation.owner_id !== userId) { return 403; }
// "unlisted" and "public" are accessible to anyone with the link
```

### 4. Discovery & tag endpoints

```ts
// Replace:  .eq('is_public', true)
// With:     .eq('visibility', 'public')
// Unlisted items are excluded from discovery — only "public" items appear
```

### 5. Sitemap generation

```ts
// Replace:  .eq('is_public', true)
// With:     .eq('visibility', 'public')
```

### 6. User Library endpoint

No change needed — already returns all creations owned by the user regardless of visibility.

## Frontend Changes

### 1. Visibility Selector (replaces the toggle)

Replace the current on/off toggle in `StoryGeneratorForm` and `LessonGeneratorForm` with a 3-option segmented control or radio group:

```
[ 🌐 Public ]  [ 🔗 Unlisted ]  [ 🔒 Private ]
```

**Behavior:**
- Default selection: **Public**
- Clicking **Private** when unauthenticated → show `LoginRequiredModal` (existing behavior)
- Clicking **Unlisted** does NOT require authentication (the content is still accessible to anyone with the link, so no ownership gate needed)

### 2. StoryPage / LessonPage badges

Replace the current private-only badge with visibility-aware badges:

- **Public**: no badge (default, clean look)
- **Unlisted**: `🔗 Unlisted` badge (neutral color, e.g. blue/gray)
- **Private**: `🔒 Private` badge (existing gray badge)

### 3. SEO meta tags

```ts
// Current: noindex when isPublic === false
// New:     noindex when visibility !== "public"
```

Both unlisted and private Creations get noindex.

## Translation Keys

### New keys to add (both `en.json` and `he.json`):

```json
"privateMode.unlistedLabel": "Unlisted",
"privateMode.unlistedSub": "Only people with the link can view",
"privateMode.unlistedBadge": "Unlisted"
```

### Existing keys to keep as-is:

- `privateMode.publicLabel`, `privateMode.publicSub`
- `privateMode.privateLabel`, `privateMode.privateSub`
- `privateMode.badge` (for the private badge)
- `privateMode.loginRequired`, `privateMode.loginBenefit`

## Test Changes (`private_creation.test.ts`)

Extend the existing test suite:

### Generation tests
- `visibility: "public"` → `visibility = 'public'` in DB
- `visibility: "unlisted"` → `visibility = 'unlisted'` in DB
- `visibility: "private"` → `visibility = 'private'` in DB
- Omitted visibility → defaults to `'public'`

### Access control tests
- Anonymous user can view **public** creation → 200
- Anonymous user can view **unlisted** creation → 200
- Anonymous user cannot view **private** creation → 403
- Different user can view **unlisted** creation → 200
- Different user cannot view **private** creation → 403
- Owner can view all three types → 200

### Discovery tests
- **Public** creations appear in `/api/discover`
- **Unlisted** creations do NOT appear in `/api/discover`
- **Private** creations do NOT appear in `/api/discover`

## Migration Checklist

1. Add `visibility` column to `creations` table in Supabase
2. Run backfill: `UPDATE creations SET visibility = CASE WHEN is_public THEN 'public' ELSE 'private' END`
3. Update `types.ts` — add `Visibility` type, replace `isPublic` and `isPrivate`
4. Update Zod schemas in `routes.ts`
5. Update server routes (generation, access control, discovery, sitemap)
6. Update `mapCreation` helper
7. Update UI components (both generator forms, both view pages)
8. Add translation keys to `en.json` and `he.json`
9. Update and extend tests
10. Drop `is_public` column after deployment is stable
