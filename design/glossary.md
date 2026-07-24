# Website Glossary

This document defines the standard terminology used for different parts of the platform to ensure consistency across the UI, code, and documentation.

## Core Content Types

### 1. Story
*   **Definition**: A personalized, AI-generated narrative experience where a child is typically the hero.
*   **Purpose**: Engagement, entertainment, and character-building.
*   **UI Reference**: "Quick Story", "My Stories", "Story Mode".
*   **Internal Term**: `Story`

### 2. Lesson
*   **Definition**: A structured, educational AI-generated guide that simplifies complex topics for learners of all ages.
*   **Purpose**: Clear explanation, academic insight, and simplification of difficult concepts.
*   **UI Reference**: "Quick Lesson", "My Lessons", "Lesson Mode".
*   **Internal Term**: `Lesson`

---

## Unified Terminology

### Creation
*   **Definition**: The primary term used to refer to any AI-generated item on the platform, encompassing both **Stories** and **Lessons**.
*   **Rationale**: A professional and neutral term that accurately describes the AI-generated nature of the content while remaining inclusive of both creative and educational outputs.
*   **Usage Examples**: 
    *   "My Library of Creations"
    *   "Manage your Creations"
    *   "Share this Creation"

---

## User Data & Personalization

### Hero Profile
*   **Definition**: The saved personal details about a child (the hero) and their world — including their name, age, gender, siblings, pets, and parent names — that are used to personalize Story generation.
*   **Alias**: `Story Profile` (acceptable informal alias; prefer **Hero Profile** in code and UI).
*   **Persistence**: Stored server-side per authenticated user so it is available across devices. Falls back to `localStorage` for unauthenticated (guest) users.
*   **UI Reference**: "Your Hero Profile", "Saved Profile", "Hero Settings".
*   **Internal Term**: `HeroProfile`
*   **Storage Key (guest)**: `hero-profile` (localStorage)

---

## UI Components & Areas

| Term | Definition |
| :--- | :--- |
| **Generator** | The main interactive area on the Home Page that houses the **Creation Widgets**. |
| **Creation Widget**| The modular input form (e.g., Story Form, Lesson Form) used to initiate content generation. These are found on the **Generator** and other landing pages. |
| **Batch Generator**| The administrative tool used to generate multiple **Creations** simultaneously from a list of prompts. |
| **Library** | The private area for authenticated users to save and manage their generated **Creations**. |
| **Creation Card**| The small preview widget that shows a **Creation's** title, illustration, and metadata in grid views (e.g., Library, Trending). |
| **Chapter** | A sub-section of a **Story**, typically representing a part of the narrative arc. |
| **Section** | A sub-section of a **Lesson**, representing a specific pedagogical topic or concept. |
| **Illustration** | The AI-generated visual associated with a **Creation**. |
| **Narration** | The Text-to-Speech audio version of the content. |
