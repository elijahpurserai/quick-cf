# Plan: Eliminate All Text from Generated Images

## Current State

Fix 1 from `illustration-no-text-fix.md` has been applied — prompts now open and close with "no text" constraints and the title has been removed. Despite this, DALL-E 3 still produces images with text. The config remains on `standard` quality and `vivid` style, which are both known to worsen the problem.

## Why DALL-E 3 Keeps Adding Text

DALL-E 3 internally rewrites prompts via a GPT-4 rewriter before generating. This rewriter often re-introduces text elements (titles, signs, labels) even when the user prompt explicitly forbids them. No amount of prompt engineering fully solves this — it's a fundamental limitation of the DALL-E 3 pipeline.

## Proposed Plan

### Phase 1 — Quick wins (apply together, low effort)

**1a. Switch quality to `hd`**
- File: `server/config.ts`
- Change `IMAGE_QUALITY` from `"standard"` to `"hd"`
- `hd` applies more generation passes, which improves prompt adherence
- Trade-off: ~2× cost per image (~$0.080 → $0.120 for 1792×1024)

**1b. Switch style to `natural`**
- File: `server/config.ts`
- Change `IMAGE_STYLE` from `"vivid"` to `"natural"`
- `natural` produces calmer compositions with fewer environmental text props (signs, books, banners, labels)
- Trade-off: slightly less vibrant images, but children's illustration style is preserved

**Expected outcome:** Reduces text occurrence noticeably but won't eliminate it entirely. Worth deploying immediately while Phase 2 is built.

---

### Phase 2 — Migrate to `gpt-image-1` (recommended, high impact)

OpenAI's `gpt-image-1` model (released April 2025) is the successor designed specifically to handle instruction-following much better than DALL-E 3. Key advantages:

- No hidden prompt rewriter — your prompt is what the model sees
- Much better at negative constraints ("no text")
- Native support for transparent backgrounds and inpainting (future possibilities)
- Same API shape, different model name and minor parameter changes

#### Changes required:

**A. `server/config.ts`**
```ts
// Before
export const IMAGE_MODEL = "dall-e-3";
export const IMAGE_SIZE: ... = "1792x1024";
export const IMAGE_QUALITY: "standard" | "hd" = "hd";       // from Phase 1
export const IMAGE_STYLE: "vivid" | "natural" = "natural";   // from Phase 1

// After
export const IMAGE_MODEL = "gpt-image-1";
export const IMAGE_SIZE = "1536x1024";   // closest supported landscape size
export const IMAGE_QUALITY: "low" | "medium" | "high" = "medium";
// IMAGE_STYLE is removed — gpt-image-1 doesn't use it
```

Note: `gpt-image-1` supported sizes differ from DALL-E 3. `1536x1024` is the closest landscape format. Alternatively use `auto` and let the model decide.

**B. `server/routes.ts` (~line 388) — update `images.generate()` call**
```ts
// Before (DALL-E 3)
const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt: prompt,
    n: 1,
    size: IMAGE_SIZE,
    quality: IMAGE_QUALITY,
    style: IMAGE_STYLE,          // ← remove this
});

// After (gpt-image-1)
const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt: prompt,
    n: 1,
    size: IMAGE_SIZE,
    quality: IMAGE_QUALITY,
    // no `style` parameter
});
```

Apply the same change in `server/generator.ts` (~line 463).

**C. Simplify the prompt**
With `gpt-image-1`, the prompt can be much cleaner since the model actually follows instructions:

```
A colorful children's illustration with absolutely no text anywhere.
{description}.
Style: warm, vibrant, kid-friendly. No words, letters, numbers, or writing.
```

The triple-repetition hack is no longer needed — a single clear instruction suffices.

**D. Update image processing pipeline**
`gpt-image-1` returns images as base64 PNG (not a URL like DALL-E 3). The download step in routes.ts needs to change:

```ts
// Before (DALL-E 3 returns a URL)
const imageUrl = response.data[0].url;
const imageResponse = await fetch(imageUrl);
const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

// After (gpt-image-1 returns base64)
const base64 = response.data[0].b64_json;
const imageBuffer = Buffer.from(base64, "base64");
```

The rest of the Sharp resize/compress/upload pipeline stays the same.

**E. Update `openai` package**
Ensure the `openai` npm package is at least v4.52+ which includes `gpt-image-1` support. Run:
```bash
npm install openai@latest
```

---

### Phase 3 — Optional: Post-generation text detection (safety net)

If any text still sneaks through (unlikely with `gpt-image-1`), add an OCR check:

1. After generating the image, run a lightweight OCR pass (e.g., Tesseract.js or GPT-4o vision with a simple "does this image contain text?" prompt)
2. If text is detected → regenerate (max 1 retry)
3. Log text-detection events for monitoring

This is optional and only worth building if Phase 2 doesn't fully solve the problem.

---

## Recommended Rollout

| Step | What | Effort | Impact | Cost change |
|------|------|--------|--------|-------------|
| Now | Phase 1a + 1b (config changes) | 5 min | Medium | ~2× per image |
| Next | Phase 2 (gpt-image-1 migration) | 1–2 hours | Very High | Similar or lower (medium quality is cheaper than DALL-E 3 HD) |
| If needed | Phase 3 (OCR safety net) | 2–3 hours | Low (cleanup) | Minimal |

## Files to Modify

| File | Phase | Change |
|------|-------|--------|
| `server/config.ts` | 1 + 2 | Quality/style config, then model swap |
| `server/routes.ts` | 2 | API call params, response handling, prompt simplification |
| `server/generator.ts` | 2 | Same as routes.ts |
| `package.json` | 2 | Update `openai` package version |
