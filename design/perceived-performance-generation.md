# Perceived Performance: Generation Wait Experience

## Problem

Story and lesson generation involves a single blocking API call that typically takes 20–45 seconds. The current UI replaces the form with a centered pulsing icon and static text ("Our AI is weaving magic..."). The user has no sense of progress, no idea how long to expect, and nothing meaningful to look at.

This is a **perception problem, not a speed problem**. The goal is not to make generation faster — it is to make the wait feel shorter and more purposeful.

---

## Strategy: Layered Perceived Progress

The approach combines four techniques, each independently valuable, and together dramatically reducing perceived wait time.

### 1. Streaming Generation (Highest Impact)

**What**: Stream the story/lesson content from the server as it's written, using Server-Sent Events (SSE) — the same mechanism already used in batch generation.

**Why it works**: Users read faster than AI writes. Showing content arriving word-by-word or line-by-line gives the user something to engage with from the very first second. The wait stops feeling like waiting and starts feeling like reading.

**How**:
- Add a `/api/generate-story/stream` endpoint that streams the OpenAI response using `stream: true` in the chat completion call
- The frontend opens the SSE connection and progressively appends text to a `content` buffer
- The story page skeleton is shown immediately; content renders into it as chunks arrive
- Once the stream closes, the creation is saved to the DB and the URL is finalized

**Phase breakdown**:
```
0s    → Page transitions immediately to story skeleton
0–2s  → Server connects to OpenAI
2s+   → Content chunks stream in, rendered live on screen
~30s  → Stream ends, creation saved, URL updated with slug
```

**UX detail**: Show a blinking cursor at the end of the streamed text (standard for AI-generated content). This makes it clear the text is still being written, not just loading.

---

### 2. Contextual Stage Messages (Medium Impact, Low Effort)

**What**: Replace the static "Our AI is weaving magic..." with time-sequenced messages that make the wait feel structured and progressing.

**Why it works**: A known sequence of steps feels faster than an unknown black box. Even if the messages don't reflect the actual server state, they create the cognitive impression of forward motion.

**Proposed sequence for stories** (each message shown for ~8s, cycling):
```
0s   → "Thinking about [childName]'s world..."
8s   → "Choosing the perfect setting..."
16s  → "Writing the opening chapter..."
24s  → "Adding a twist to the adventure..."
32s  → "Putting on the finishing touches..."
40s+ → "Almost ready..." (loops)
```

**Proposed sequence for lessons**:
```
0s   → "Researching [topic]..."
8s   → "Structuring the lesson..."
16s  → "Writing clear explanations..."
24s  → "Adding examples and activities..."
32s  → "Almost ready..."
```

Messages reference the user's actual input (child name, topic) to feel personal, not generic.

**Implementation**: A `useEffect` with an interval that advances through a message array. No server changes needed.

---

### 3. Skeleton Preview of the Result Page (Medium Impact)

**What**: As soon as the user submits, navigate immediately to the story/lesson page in a skeleton state — showing the page layout (title area, image area, badge strip, content lines) with animated shimmer placeholders instead of content.

**Why it works**: The user sees the destination immediately. The form is gone; the result page is there, being filled in. This matches the pattern used by social feeds, YouTube, and most modern apps.

**Skeleton structure for a story page**:
```
┌─────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░ (image) │
│                                     │
│  ████████████████████               │  ← title shimmer
│  ░░░░░ ░░░░░ ░░░░░░░                │  ← badge row shimmer
│                                     │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│  ░░░░░░░░░░░░░░░░░░░░░░░            │  ← content lines shimmer
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │
└─────────────────────────────────────┘
```

**Without streaming**: Show skeleton until API call resolves, then populate all at once. Already a big improvement over the current blank-form-replaced-with-spinner pattern.
**With streaming**: Skeleton transitions directly into live streaming content.

**Implementation**: Add a `isGenerating` prop or route state to `StoryPage`/`LessonPage`. When true, render shimmer placeholders instead of real content.

---

### 4. Time Expectation Setting (Low Impact, Very Low Effort)

**What**: Show a subtle progress bar that fills over an estimated duration, plus a text hint.

**Why it works**: Uncertainty is more stressful than a known wait. Telling users "usually about 30 seconds" removes anxiety even if the actual time varies.

**Design**:
- A thin progress bar below the stage message, advancing smoothly from 0% to 90% over 35 seconds
- Stops at 90% and pulses gently if generation takes longer (never hits 100% until done)
- Small caption: *"Usually about 30 seconds"*

**Important**: The bar is purely cosmetic — it advances on a timer, not based on actual server progress. It should never suggest it's done before it actually is.

---

## Recommended Implementation Order

| Phase | Technique | Effort | Impact |
|-------|-----------|--------|--------|
| 1 | Contextual stage messages + time bar | 1–2 hours | High perceived improvement, zero backend changes |
| 2 | Skeleton preview (without streaming) | 3–5 hours | Significant, frontend only |
| 3 | Streaming generation | 1–2 days | Maximum impact, requires backend SSE endpoint |

Phase 1 alone will meaningfully improve the experience. Phases 2 and 3 together represent the full solution.

---

## What Not to Do

- **Fake progress steps that lie** — e.g. "Step 1 of 3: Done ✓" with fabricated checkmarks while the server is still processing. Users feel betrayed when they notice the mismatch.
- **Music or sound effects** — intrusive and impossible to control in a shared environment.
- **Fun facts or tips panel** — adds cognitive load during an already anxious wait. Keep the focus on the creation being made.
- **A cancel button that can't actually cancel** — if cancel is offered, the server request must be abortable (use `AbortController`). A fake cancel button that just navigates away while the server keeps working is confusing.

---

## Files to Change (when implementing)

| File | Change |
|------|--------|
| `website/src/app/pages/HomePage.tsx` | Stage messages, progress bar, navigate-first pattern |
| `website/src/app/pages/StoryPage.tsx` | Skeleton state when `isGenerating` |
| `website/src/app/pages/LessonPage.tsx` | Skeleton state when `isGenerating` |
| `server/routes.ts` | New `/generate-story/stream` SSE endpoint (Phase 3) |
| `website/src/app/services/api.ts` | Streaming fetch handler (Phase 3) |
