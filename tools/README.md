# Quick Maintenance Tools

This directory contains utility scripts for database maintenance, content auditing, and SEO optimization.

## 🛠️ Tools Overview

### 🎨 Image Fixer (`fix_missing_images.ts`)
**Purpose:** Identifies stories or lessons missing an illustration, generates a new one using OpenAI DALL-E 3, and saves it permanently to Supabase storage.
**Usage:**
```bash
# From the project root
npx ts-node tools/fix_missing_images.ts
```

### 🧹 Lesson Cleanup (`cleanup_lessons.ts`)
**Purpose:** Scans the database for "invalid" lessons (missing images or tags) and deletes them to keep the discovery feed high-quality.
**Usage:**
```bash
# From the project root
npx ts-node tools/cleanup_lessons.ts
```

### 🔍 Lesson Auditor (`audit_lessons.ts`)
**Purpose:** A "dry-run" version of the cleanup script. It reports which lessons would be deleted without actually removing any data.
**Usage:**
```bash
# From the project root
npx ts-node tools/audit_lessons.ts
```

### 🤖 SEO Prerenderer (`server/seo_prerender.ts`)
**Note:** This is a live middleware used by the server, not a standalone script.
**Purpose:** Detects search engine bots and serves them a minimal, static HTML version of stories and lessons for better indexing.

---

## ⚙️ Setup & Requirements
- These tools require valid environment variables in `website/.env` (specifically `OPENAI_API_KEY`, `VITE_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`).
- They use `ts-node` for execution without a pre-build step.
