# Database Design: Postgres + Supabase Integration

This document outlines the database schema and integration strategy for the content creation platform, focusing on Stories, Lessons, Assets, and User personalization.

## Core Principles
1. **Supabase Auth Integration**: Use Supabase's native authentication and link user data to the `auth.users` table.
2. **Row-Level Security (RLS)**: Implement strict RLS policies to ensure users can only access their own data while allowing public access to published content.
3. **Storage Integration**: Store large binary assets (Audio, Images) in Supabase Storage buckets, with references in the database.
4. **SEO Optimization**: Optimize schema for fast querying of slugs and metadata for sitemaps and search engines.

---

## Database Schema (Postgres)

### 1. `profiles`
Extends Supabase Auth users with application-specific metadata.
- `id`: `uuid` (PK, references `auth.users.id`)
- `email`: `text` (Unique)
- `full_name`: `text`
- `avatar_url`: `text`
- `created_at`: `timestamp with time zone` (Default: `now()`)
- `updated_at`: `timestamp with time zone` (Default: `now()`)

### 2. `creations` (Base Table)
A central table to track all user-generated content for general queries (e.g., library, search).
- `id`: `uuid` (PK, Default: `gen_random_uuid()`)
- `owner_id`: `uuid` (References `profiles.id`)
- `type`: `text` (e.g., 'story', 'lesson')
- `slug`: `text` (Unique, Index)
- `title`: `text`
- `english_title`: `text`
- `description`: `text`
- `is_public`: `boolean` (Default: `false`)
- `rating_avg`: `float` (Default: `0`)
- `rating_count`: `int` (Default: `0`)
- `created_at`: `timestamp with time zone` (Default: `now()`)
- `updated_at`: `timestamp with time zone` (Default: `now()`)

### 3. `stories`
Specific attributes for child-focused stories.
- `id`: `uuid` (PK, references `creations.id` on delete cascade)
- `content`: `text` (Markdown)
- `child_name`: `text`
- `age`: `int`
- `gender`: `text`
- `purpose`: `text`
- `education_category`: `text`
- `language`: `text`
- `metadata`: `jsonb` (For siblings, parents, pet info, etc.)

### 4. `lessons`
Specific attributes for educational lessons.
- `id`: `uuid` (PK, references `creations.id` on delete cascade)
- `content`: `text` (Markdown)
- `topic`: `text`
- `level`: `text`
- `tone`: `text`
- `duration_mins`: `int`
- `language`: `text`

### 5. `assets`
Links binary files in storage to creations.
- `id`: `uuid` (PK)
- `creation_id`: `uuid` (References `creations.id`)
- `asset_type`: `text` (e.g., 'image_main', 'audio_narration')
- `storage_path`: `text` (Path in Supabase bucket)
- `public_url`: `text`
- `provider`: `text` (e.g., 'openai-dalle', 'openai-tts')
- `created_at`: `timestamp with time zone` (Default: `now()`)

### 6. `tags`
Universal tagging system for SEO and discovery.
- `id`: `uuid` (PK)
- `name`: `text` (Unique)
- `slug`: `text` (Unique, Index)
- `category`: `text` (e.g., 'educational', 'bedtime', 'character')

### 7. `creation_tags`
Join table for creations and tags.
- `creation_id`: `uuid` (References `creations.id`)
- `tag_id`: `uuid` (References `tags.id`)
- Primary Key: (`creation_id`, `tag_id`)

### 8. `favorites`
User preferences for saving content.
- `user_id`: `uuid` (References `profiles.id`)
- `creation_id`: `uuid` (References `creations.id`)
- `created_at`: `timestamp with time zone` (Default: `now()`)
Primary Key: (`user_id`, `creation_id`)

---

## Supabase Integration Strategy

### Storage Buckets
1. **`story-images`**:
   - Structure: `/{user_id}/{creation_id}/main.png`
   - Access: Public read, Authenticated write (user's own folder).
2. **`story-audio`**:
   - Structure: `/{user_id}/{creation_id}/narration.mp3`
   - Access: Public read, Authenticated write.

### Row-Level Security (RLS)
- **`profiles`**: User can read/write their own record.
- **`creations`**: 
  - Read: All if `is_public` is true; Owner only if `is_public` is false.
  - Write/Update/Delete: Owner only.
- **`assets`**: 
  - Read: Public (if creation is public).
  - Write: Owner of the `creation_id`.
- **`favorites`**: Owner only can read/write their own favorites.

### Database Functions & Triggers
1. **`on_auth_user_created`**: Trigger to automatically create a profile record when a user signs up.
2. **`update_rating_stats`**: Trigger to update `creations.rating_avg` when a new rating is added.
3. **`handle_updated_at`**: Standard trigger to update `updated_at` timestamps.

---

## Migration Path
1. **Phase 1**: Set up Tables, Enums, and Relationships.
2. **Phase 2**: Enable RLS and define Policies.
3. **Phase 3**: Configure Storage buckets and CORS.
4. **Phase 4**: Implement Database Triggers for profile creation.
