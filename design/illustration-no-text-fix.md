# Fix: Illustrations Generated with Unwanted Text

## Problem

AI-generated Illustrations for Creations (both Stories and Lessons) sometimes contain text, letters, words, or labels, despite the prompt explicitly prohibiting it.

### Affected Code
- `server/routes.ts` — `/generate-story-image` endpoint (on-demand Illustration generation)
- `server/generator.ts` — `generateImageForCreation()` (Batch Generator flow)

Both use identical prompt phrasing:
> `IMPORTANT: The image must NOT contain any text, words, signatures, or characters.`

---

## Root Causes

1. **Model**: DALL-E 3 is known to frequently include text in images even when instructed not to — it's an inherent limitation of its training data.
2. **Quality**: Currently set to `standard`. DALL-E 3 follows instructions more reliably at `hd` quality.
3. **Style**: Currently set to `vivid`. This style tends toward dramatic compositions that often introduce environmental text (signs, book covers, banners, labels).
4. **Prompt structure**: The "no text" instruction is placed at the end of a long prompt, where it competes with earlier visual descriptions and carries less weight.
5. **No retry logic**: If the model returns an Illustration with text, it is accepted as-is with no fallback.

---

## Proposed Fixes

### Fix 1 — Strengthen and reposition the no-text instruction (Prompt Engineering)

Move the constraint to the **start** of the prompt, remove the title (titles invite the model to render them visually), and repeat the constraint at the end.

**Both files** (`routes.ts`, `generator.ts`):
```
// Before
"A high-quality digital illustration for children titled '{title}'. {description}. ...
IMPORTANT: The image must NOT contain any text, words, signatures, or characters. The illustration should be visual only."

// After
"A purely visual, text-free illustration for children. No text, letters, words, numbers, signs, labels, captions, or writing of any kind anywhere in the image.
{description}.
Style: warm and cozy for bedtime stories, bright and educational for learning stories, realistic for everyday-life stories, imaginative for adventure or fantasy.
Vibrant, safe for kids. Absolutely no typography or written characters anywhere in the image."
```

Key changes:
- Opens with the constraint
- Removes `'{title}'` from the prompt — titles invite text rendering
- Replaces `IMPORTANT:` (ignored by the model) with plain declarative language
- Repeats the constraint at the end

---

### Fix 2 — Upgrade quality to `hd`

`hd` quality applies more generation passes and has noticeably better prompt adherence.

**File**: `server/config.ts`
```ts
// Before
export const IMAGE_QUALITY: "standard" | "hd" = "standard";

// After
export const IMAGE_QUALITY: "standard" | "hd" = "hd";
```

**Trade-off**: ~2x cost per Illustration. Worth evaluating given the current failure rate.

---

### Fix 3 — Switch style from `vivid` to `natural`

`natural` style produces calmer compositions with fewer props that tend to carry text (signs, books, banners).

**File**: `server/config.ts`
```ts
// Before
export const IMAGE_STYLE: "vivid" | "natural" = "vivid";

// After
export const IMAGE_STYLE: "vivid" | "natural" = "natural";
```

**Trade-off**: Illustrations may feel less vibrant. Recommend A/B testing before applying globally.

---

### Fix 4 — Migrate to `gpt-image-1` (Longer Term)

OpenAI's `gpt-image-1` has significantly better instruction-following than DALL-E 3 and handles negative constraints more reliably.

**Trade-off**: Requires API access (currently limited rollout), updated API parameters, and full prompt retesting.

---

## Recommended Rollout Order

| Priority | Fix | Effort | Expected Impact |
|---|---|---|---|
| 1 | Strengthen prompt — Fix 1 | Low | High |
| 2 | Upgrade to `hd` quality — Fix 2 | Low | Medium |
| 3 | Test `natural` style — Fix 3 | Low | Medium |
| 4 | Migrate to `gpt-image-1` — Fix 4 | High | High |

Start with **Fix 1 + Fix 2** together — low risk, non-breaking changes to three files.

---

## Files to Modify

| File | Change |
|---|---|
| `server/config.ts` | `IMAGE_QUALITY` → `"hd"` / optionally `IMAGE_STYLE` → `"natural"` |
| `server/routes.ts` | Rewrite prompt string (~line 383) |
| `server/generator.ts` | Rewrite prompt string (~line 461) |