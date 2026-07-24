# Hero Profile — Server-Side Persistence Design

## Overview

The **Hero Profile** (alias: Story Profile) holds the personal details a parent fills in about their child — name, age, gender, siblings, pets, parent names, and preferred language. Currently these are stored only in `localStorage`, meaning they are lost when the user switches devices or clears their browser.

This design moves Hero Profiles to the server (Supabase) as the source of truth for authenticated users, while keeping `localStorage` as the fallback for guests. A user can have **multiple** Hero Profiles (one per child) and select between them in the Story form.

---

## Data Shape

Each individual profile:

```ts
interface HeroProfile {
  id: string;             // client-generated UUID, used as a stable key
  childName: string;
  gender: "male" | "female" | "unspecified";
  age: number | null;
  siblingNames: { name: string; gender: "male" | "female" | "unspecified" }[];
  pets: { name: string; type: string }[];
  parentNames: { name: string; gender: "male" | "female" | "unspecified" }[];
  language: string;
}
```

The full list stored per user:

```ts
type HeroProfiles = HeroProfile[];   // ordered; index 0 is the default
```

`id` is generated on the client (e.g. `crypto.randomUUID()`) so that add/remove/reorder operations can be applied locally first and then synced as a single array write — no separate ID-assignment round-trip needed.

---

## Database Schema

### Option A — JSONB array column on `profiles` ✅ Chosen

Add a single `hero_profiles` JSONB column to the existing `profiles` table:

```sql
ALTER TABLE profiles
  ADD COLUMN hero_profiles jsonb DEFAULT '[]'::jsonb;
```

This stores the full ordered array of profiles as a JSON blob. Since we always load all profiles at once and write the full array back (no partial row queries needed), there is no query advantage to a separate table. The JSONB column is simpler, requires no joins, and keeps the migration trivial.

**Pros**: No new table, no joins, trivial migration, load/save in one round-trip.
**Cons**: Not individually queryable by field — but we never need that, so it's not a real limitation.

---

## API Endpoints

Both routes require authentication via the existing `authenticateJWT` middleware.

### `GET /api/me/hero-profiles`

Returns the full ordered array of Hero Profiles for the authenticated user.

**Response (200)**:
```json
{
  "heroProfiles": [
    {
      "id": "a1b2c3d4-...",
      "childName": "Lior",
      "gender": "male",
      "age": 5,
      "siblingNames": [{ "name": "Maya", "gender": "female" }],
      "pets": [{ "name": "Buddy", "type": "dog" }],
      "parentNames": [{ "name": "Elijah", "gender": "male" }],
      "language": "en"
    },
    {
      "id": "e5f6g7h8-...",
      "childName": "Maya",
      "gender": "female",
      "age": 3,
      "siblingNames": [{ "name": "Lior", "gender": "male" }],
      "pets": [{ "name": "Buddy", "type": "dog" }],
      "parentNames": [{ "name": "Elijah", "gender": "male" }],
      "language": "en"
    }
  ]
}
```

**Response when none saved (200)**:
```json
{ "heroProfiles": [] }
```

**Response when unauthenticated (401)**:
```json
{ "error": "Authentication required" }
```

---

### `PUT /api/me/hero-profiles`

Replaces the full array of Hero Profiles for the authenticated user. The client always sends the complete list (add, remove, and reorder are all expressed as a full array write).

**Request body**:
```json
{ "heroProfiles": [ ...array of HeroProfile objects... ] }
```

**Response (200)**:
```json
{ "heroProfiles": [ ...saved array... ] }
```

**Validation** (Zod schema on the server):

```ts
const HeroProfileSchema = z.object({
  id: z.string().uuid(),
  childName: z.string().max(100),
  gender: z.enum(["male", "female", "unspecified"]),
  age: z.number().min(0).max(18).nullable(),
  siblingNames: z.array(z.object({
    name: z.string().max(100),
    gender: z.enum(["male", "female", "unspecified"]),
  })).max(10),
  pets: z.array(z.object({
    name: z.string().max(100),
    type: z.string().max(100),
  })).max(10),
  parentNames: z.array(z.object({
    name: z.string().max(100),
    gender: z.enum(["male", "female", "unspecified"]),
  })).max(10),
  language: z.string().max(10),
});

const HeroProfilesSchema = z.object({
  heroProfiles: z.array(HeroProfileSchema).max(20),
});
```

---

## Client-Side Changes

### 1. `api.ts` — new `heroProfiles` namespace

```ts
export const api = {
  // ...existing...
  heroProfiles: {
    get: async (): Promise<HeroProfile[]> => { ... },
    save: async (profiles: HeroProfile[]): Promise<HeroProfile[]> => { ... },
  },
};
```

### 2. `AppContext.tsx` — load profiles on login

On successful login (and on session restore via `auth/me`), fetch the Hero Profiles array and store it in context:

```ts
const [heroProfiles, setHeroProfiles] = useState<HeroProfile[]>([]);

// After confirming user is logged in:
const serverProfiles = await api.heroProfiles.get();
setHeroProfiles(serverProfiles);
```

Expose `heroProfiles` and `saveHeroProfiles` from the context. Any add/remove/edit operation goes through `saveHeroProfiles`, which updates state and syncs to the server.

### 3. `StoryGeneratorForm.tsx` — profile picker + sync

The form gains a profile picker at the top (e.g. chips or a small dropdown listing each child's name). Selecting a profile pre-fills the form fields.

Read/write strategy:

- **Read**: Context (server data for logged-in users) → `localStorage` (guest fallback).
- **Write**: Always write to `localStorage` immediately. If authenticated, also call `api.heroProfiles.save(fullArray)` debounced (~1 second).

Guests continue to work exactly as today (single profile in `localStorage`). On first login, the server list overwrites the local cache.

### 4. localStorage key rename + guest multi-profile

Rename the storage key from `"story-child-profile"` to `"hero-profiles"` and change its value to the array format. Apply a one-time migration shim on load:

```ts
// One-time migration from old single-profile format
const legacy = localStorage.getItem("story-child-profile");
if (legacy && !localStorage.getItem("hero-profiles")) {
  const parsed = JSON.parse(legacy);
  const migrated: HeroProfile[] = [{
    id: crypto.randomUUID(),
    ...parsed,
  }];
  localStorage.setItem("hero-profiles", JSON.stringify(migrated));
  localStorage.removeItem("story-child-profile");
  localStorage.removeItem("story-child-profile-history"); // history also retired
}
```

---

## Sync Strategy Summary

| Scenario | Read source | Write target |
|---|---|---|
| Guest user | `localStorage` (array) | `localStorage` only |
| Logged-in user (first load) | Server (overrides local) | Server + `localStorage` |
| Logged-in user (editing/adding/removing profiles) | Context (already loaded) | Server (debounced) + `localStorage` |
| User logs out | `localStorage` remains as-is | — |
| User logs in on new device | Server array loaded | Overwrites empty local cache |

---

## Migration Steps

1. **Database**: Run `ALTER TABLE profiles ADD COLUMN hero_profiles jsonb DEFAULT '[]'::jsonb;` in Supabase.
2. **Server**: Add `GET` and `PUT /api/me/hero-profiles` routes (in `routes.ts` or a new `profileRoutes` router).
3. **Client — `api.ts`**: Add `api.heroProfiles.get()` and `api.heroProfiles.save()`.
4. **Client — `AppContext.tsx`**: Fetch and store the profiles array in context on login/session restore; expose `heroProfiles` and `saveHeroProfiles`.
5. **Client — `StoryGeneratorForm.tsx`**: Add profile picker UI; replace direct localStorage usage with context read + dual-write.
6. **localStorage migration shim**: Apply on form load to convert old single-profile format to array format.
7. **RLS**: The existing owner-only write policy on `profiles` already covers the new column — no changes needed.

---

## Out of Scope for This Design

- Profile history / undo — the existing `story-child-profile-history` localStorage key is retired by the migration shim and not replicated server-side (low value).
- Per-profile language override vs. global language preference — treat `language` inside each HeroProfile as the preferred generation language for that child; the UI can still show a global language toggle.
