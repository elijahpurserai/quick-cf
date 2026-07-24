# Private Creation Design

## Problem & Goal

All Creations (Stories and Lessons) are currently public — they appear in Discovery and are accessible to anyone with a link. There is no way for users to generate something personal that they don't want shared.

The goal is to introduce a **Private mode** toggle on the Generator. Private Creations are only visible to their owner (in the Library) and are excluded from Discovery. Because this feature requires a logged-in account, it also serves as a conversion funnel to push anonymous users to sign in.

---

## Feature Description

- A **Private toggle** is added to both the Story and Lesson Creation Widgets on the Generator.
- The toggle is **visible to all users** (logged in or not) so that anonymous users are aware the feature exists.
- When an anonymous user clicks the toggle, a **login modal** appears explaining the benefit and offering a "Sign in with Google" button.
- After logging in, the toggle activates and the user can generate a private Creation.
- When a logged-in user generates with the toggle on, the Creation is saved with `is_public = false`.
- Private Creations are automatically excluded from all Discovery queries (which already filter `is_public = true`).
- Private Creations appear normally in the owner's Library (which queries by `owner_id`).
- Visiting a private Creation's URL while unauthenticated or as a different user returns a 403.

---

## UX Flow

### Logged-out user
1. User sees the Generator with a "Private Story" toggle (lock icon, off by default).
2. User clicks the toggle.
3. A modal appears: *"Sign in to create private stories"* with a brief description and a Google login button.
4. User signs in → modal closes, toggle turns on.
5. User fills in the form and clicks Generate.
6. Creation is saved as private. User is redirected to the story page.

### Logged-in user
1. User sees the toggle (off by default).
2. User clicks the toggle → it turns on immediately (no modal).
3. User fills in the form and clicks Generate.
4. Creation is saved as private, appears in Library only.

---

## Technical Approach

No database schema changes are needed. The `creations` table already has:

```sql
is_public boolean DEFAULT false
```

Currently, generation endpoints hardcode `is_public: true`. This changes to `is_public: !isPrivate` based on the flag sent from the frontend.

### Data flow

```
Toggle (on) → formData.isPrivate = true
  → POST /api/generate-story { ...fields, isPrivate: true }
  → StorySchema.parse: isPrivate validated
  → INSERT creations SET is_public = false
  → Discovery queries (.eq('is_public', true)) exclude it
  → Library query (.eq('owner_id', userId)) includes it
```

---

## Files Changed

| File | Change |
|------|--------|
| `website/src/app/types.ts` | Add `isPrivate?: boolean` to `StoryFormData` and `LessonFormData` |
| `website/src/app/components/LoginRequiredModal.tsx` | New modal component for the login CTA |
| `website/src/app/components/StoryGeneratorForm.tsx` | Privacy toggle + modal integration |
| `website/src/app/components/LessonGeneratorForm.tsx` | Privacy toggle + modal integration |
| `server/routes.ts` | Extend Zod schemas; map `isPrivate` → `is_public` on insert |
| `website/src/app/i18n/en.json` + `he.json` | New `privateMode.*` translation keys |
