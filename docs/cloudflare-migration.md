# Cloudflare Migration Plan

**Status:** In review (round 1) — backend Worker-ization implemented (batch 1 landed in the repo)
**Scope:** Move Quick's hosting/compute off Render (two services — static site + Node API) onto Cloudflare, as a single-origin Worker. Supabase (Postgres + Auth + Storage) stays unchanged.
**Related:** [og_resolver_design](../design/og_resolver_design.md) · [web-site-server-interaction](../design/web-site-server-interaction.md) · [creation-image-optimization](../design/creation-image-optimization.md)
**Author:** Elijah
**Project:** Quick (quickstory.ai)

Quick runs today as two Render services — a static CDN for the Vite/React frontend and a Node/Express API — split across `quickstory.ai` and `api.quickstory.ai`. That split is the source of most of the accidental complexity in the codebase: an in-memory proxy of the CDN's `index.html` to dodge asset-hash mismatches (`server/index.ts`), a Render rewrite-rule workaround for OG injection, and cross-subdomain CORS and cookie handling. This plan collapses both services into **one Cloudflare Worker on a single origin** (`quickstory.ai`): Workers Static Assets serves the frontend, the existing Express app runs on the same Worker via the Node-compat `httpServerHandler` shim, and Cloudflare DNS/CDN/compute all live in one account — the consolidation goal. The one hard blocker is `sharp` (a native binary that will not run in a Worker); it is used in exactly two admin-only code paths that already degrade gracefully, so removing it from the Worker is low-risk. The database, auth backend, and image storage stay on Supabase and are explicitly out of scope.

---

## 1. Current state (grounded in the code)

Quick is a monorepo with three parts: `website/` (Vite + React 18 SPA), `server/` (Express 5 + TypeScript, compiled with `tsc` to `server/dist/`), and `tools/` (local `ts-node` maintenance scripts). `start-dev.sh` runs both halves locally on ports 5173 (Vite) and 3001 (Express).

**Two Render services, two origins.** The frontend is a Render static site served at `quickstory.ai`; the API is a Render Node service at `api.quickstory.ai`. Because each service builds the frontend independently with different `VITE_*` env vars, their content-hashed bundle filenames diverge — so `server/index.ts` carries a workaround (`getCdnIndexHtml`, `cachedIndexHtml`, `INDEX_CACHE_TTL_MS`) that fetches and caches the CDN's `index.html` at runtime so browsers always request assets that actually exist on the CDN. This whole mechanism exists only because the two services are separate.

**The OG/SEO hot path runs through Express.** `server/index.ts` registers `sitemapRoutes` (`server/sitemap.ts` — `robots.txt`, `sitemap.xml` + per-language story/lesson/tag sitemaps) and `seoPrerender` (`server/seo_prerender.ts`), then a catch-all `app.get(/.*/ )` that, for `/…/story/:slug` and `/…/lesson/:slug` paths, looks up the creation in Supabase and injects OG/Twitter meta tags into the served HTML via `buildPageHtml`. Image URLs for OG are rewritten to Supabase on-the-fly transforms by `toOgImageUrl` (`server/image_utils.ts`). A Render rewrite rule (`/*/story/*` → `https://api.quickstory.ai/*/story/*`) proxies SPA HTML paths to the API so bots get real meta tags; `design/og_resolver_design.md` documents a Render wildcard bug that this rewrite triggers and works around with a loose regex.

**API surface.** `server/index.ts` mounts `discoveryRoutes`, `generatorRoutes`, `storyRoutes`, `lessonRoutes`, `userRoutes` (all in `server/routes.ts`), `authRoutes` (`server/auth.ts`), `adminRoutes` (`server/admin.ts`), and `testRunnerRoutes` (`server/tests/runner.ts`, backing the in-app tests page), plus `/health`. Middleware: `cors` (with a custom origin allowlist derived from `CLIENT_URL` + localhost, allowing base domains and subdomains), `express.json`, `cookie-parser`, and an `X-Robots-Tag` header.

**Auth.** `server/auth.ts` verifies Google ID tokens (`google-auth-library`), issues a signed JWT (`jsonwebtoken`) in an httpOnly cookie, and upserts a `profiles` row in Supabase. The cookie domain is derived from `CLIENT_URL` as `.quickstory.ai` so the token is shared between `quickstory.ai` and `api.quickstory.ai`. Admin gating is by email allowlist (`APPROVED_EMAILS` in `server/config.ts`).

**`sharp` — the one native dependency.** It appears in `server/routes.ts` (~line 398, single story/lesson image generation) and `server/generator.ts` (~line 418, batch generation). Both lazily `require('sharp')` inside a `try/catch` to resize the DALL·E output to a ≤500KB WebP before uploading to the Supabase `creations` bucket. Critically, **both already fall back gracefully**: if `sharp` throws, `isWebp` stays `false` and the raw PNG is uploaded instead (`server/routes.ts` line ~415, `server/generator.ts` line ~435). `sharp` also appears in `tools/fix_missing_images.ts`, which runs locally via `ts-node`, never on the server.

**Persistence & external services (unchanged by this plan).** Supabase provides Postgres (`creations`, `stories`, `lessons`, `tags`, `profiles`, …), Auth-adjacent storage of `profiles`, the `creations` storage bucket, and on-the-fly image transforms (`/storage/v1/render/image/…`, already used by `toOgImageUrl`). OpenAI provides text (`gpt-4o-mini`) and images (`dall-e-3`). These are reached over HTTPS and are hosting-agnostic.

**Deploy.** `tools/deploy.sh` pushes `main`, then fast-forwards and pushes a `prod` branch; Render auto-deploys both services from `prod`. `package.json` `deploy` script wraps it.

**Environment variables in play** (from `website/.env`, read via `dotenv` in `server/config.ts`'s import chain and by Vite): `CLIENT_URL`, `FRONTEND_DIST_PATH`, `PORT`, `NODE_ENV`, `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `VITE_BASE_URL`.

---

## 2. Goals

1. **One origin, one deployment.** Serve the SPA and the API from a single Cloudflare Worker on `quickstory.ai`, retiring the `api.quickstory.ai` split.
2. **Consolidate onto Cloudflare.** DNS, CDN, and compute in one Cloudflare account — the primary motivation for the move.
3. **Preserve behavior exactly.** SEO sitemaps, OG/Twitter meta injection for story/lesson pages, Google login, the admin generator, and the in-app tests page all keep working, verified before cutover.
4. **Delete accidental complexity.** Remove the CDN-`index.html` proxy hack, the asset-hash mismatch, the Render rewrite rule, and the Render wildcard workaround — they only existed because of the two-service split.
5. **Keep the Express codebase.** Reuse the existing Express app via the Node-compat shim rather than rewriting routes to a new framework, to minimize risk and diff size.
6. **No data migration.** Supabase stays authoritative; nothing in Postgres or Storage moves.

---

## 3. Non-goals

- **Moving Supabase.** Postgres, auth data, and the `creations` storage bucket stay on Supabase. No D1/R2 migration in this plan.
- **Rewriting Express to Hono/itty-router.** The app is wrapped, not rewritten. A future rewrite can be its own plan.
- **Changing the frontend framework or build.** Vite + React stays; only where the build output is *served* changes.
- **Re-architecting the OG resolver registry.** `design/og_resolver_design.md`'s Part 1 (the Render rewrite changes) becomes obsolete under one origin — there is no cross-origin proxy to configure once frontend and API share a Worker (see Open decision 5 for the full why). Its Part 2 (the resolver-registry refactor) is a hosting-independent code-organization improvement, still valid but optional and tracked separately.
- **Adding Cloudflare Queues/Cron for batch generation** beyond noting it as a risk mitigation (Section 11).

---

## 4. Target architecture

One Worker, one origin. Cloudflare **Static Assets** serves everything in `website/dist` (hashed JS/CSS, images, `favicon.png`) directly from the edge for free. The Worker runs only where it must:

- `run_worker_first` is set for `/api/*`, the SEO file routes (`/robots.txt`, `/sitemap*.xml`), and the SPA HTML paths that need OG injection (`/:lang/story/*`, `/:lang/lesson/*`) — these are handed to the Express app.
- Every other path is served from Static Assets, with `not_found_handling: "single-page-application"` returning `index.html` for unmatched client-side routes.

The Express app is imported into the Worker and wrapped with **`httpServerHandler`** from the `cloudflare:workers` module (no `app.listen()` in the Worker path; that moves to a dev-only entry). `express.json()`, `cors`, and `cookie-parser` run unchanged under `nodejs_compat` — all three are confirmed-compatible middleware. The Worker exposes an `ASSETS` binding so the OG catch-all can read the built `index.html` from the edge (`env.ASSETS.fetch`) and inject meta tags into it, replacing the runtime CDN fetch.

```
              ┌────────────────────────── quickstory.ai (one Cloudflare zone) ──────────────────────────┐
  Browser ─▶  │  Cloudflare edge                                                                         │
  / Bot       │    ├─ /assets/*, /images/*, /favicon.png, hashed bundles ─▶ Static Assets (free)         │
              │    ├─ /:lang/story/:slug , /:lang/lesson/:slug ─▶ Worker ─▶ Express OG catch-all          │
              │    │                                        (reads index.html via ASSETS, injects OG)     │
              │    ├─ /api/* , /robots.txt , /sitemap*.xml   ─▶ Worker ─▶ Express routes                  │
              │    └─ any other path (SPA route)             ─▶ Static Assets → index.html (SPA fallback) │
              └──────────────────────────────────────────────┬───────────────────────────────────────────┘
                                                              ▼
                                         Supabase (Postgres · Auth data · Storage · image transforms)
                                         OpenAI (gpt-4o-mini · dall-e-3)
```

**What this collapses.** Same origin means: the `getCdnIndexHtml`/`cachedIndexHtml` proxy in `server/index.ts` is deleted (the Worker reads its own co-located `index.html`); the asset-hash mismatch cannot occur (one build, one deploy); `cors` simplifies to same-origin (browser calls to `/api/*` are first-party); and the cookie no longer needs to span two subdomains.

---

## 5. Backend changes — Express on a Worker

The Express app already exports `app` (`export default app` in `server/index.ts`) and only calls `app.listen()` when `NODE_ENV !== "test"`. Restructure so the listen call is isolated and the app is Worker-importable.

| Change | File | Detail |
|---|---|---|
| Split entry | `server/index.ts` → keep app, remove `app.listen` | Export the configured `app`; move `app.listen(PORT)` into a new `server/dev.ts` used only by `npm run dev` (nodemon) locally. |
| Add Worker entry | new `server/worker.ts` | Import `./env-shim` first (side-effect), expose the assets binding as `globalThis.__ASSETS__`, `import app from "./index"`, `app.listen(PORT)`, then `export default httpServerHandler({ port: PORT })`. **Correct imports:** `httpServerHandler` from `cloudflare:node`, `env` from `cloudflare:workers`. |
| Add env shim | new `server/env-shim.ts` | Copies string-valued Worker bindings onto `process.env` (Workers does **not** populate `process.env` automatically), so the existing `process.env.*` reads keep working. Must be imported before `./index`. |
| Delete CDN proxy | `server/index.ts` | Remove `getCdnIndexHtml`, `cachedIndexHtml`, `cacheTimestamp`, `INDEX_CACHE_TTL_MS`. |
| Rework catch-all | `server/index.ts` `app.get(/.*/ )` | Fetch base HTML from the `ASSETS` binding instead of the remote CDN, then run the existing `buildPageHtml` to inject OG tags. Drop the `express.static(distPath)` block and `distCandidates` logic — Static Assets serves the SPA now. |
| Remove `sharp` from Worker path | `server/routes.ts` (~L398), `server/generator.ts` (~L418) | See Section 7. |
| Simplify CORS (optional) | `server/index.ts` | Same-origin browser calls no longer need the subdomain allowlist; keep the allowlist for any server-to-server callers, or trim to `CLIENT_URL`. |
| Cookie domain | `server/auth.ts` `COOKIE_DOMAIN` | With one origin, `.quickstory.ai` still works; can simplify to host-only. Verify Google login end-to-end after cutover. |

**Env/secrets.** The app reads `process.env.*`. In the Worker, put public/non-secret values (`CLIENT_URL`, `VITE_SUPABASE_URL`, `NODE_ENV`) in `[vars]` and secrets (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`) via `wrangler secret put`. **Confirmed during implementation:** Workers exposes these on the `env` object from `cloudflare:workers`, **not** on `process.env` — so `server/env-shim.ts` copies them across before `./index` is imported. `server/config.ts`'s `dotenv.config()` stays as a harmless no-op in the Worker (still used by local dev). `FRONTEND_DIST_PATH` and `PORT` are no longer needed on the Worker.

**`wrangler.jsonc` (sketch).**

```jsonc
{
  "name": "quick",
  "main": "server/worker.ts",
  "compatibility_date": "2025-05-01",        // bump to deploy date; node:http support needs a recent date
  "compatibility_flags": ["nodejs_compat"],  // nodejs_compat (v2 behavior is on by default at recent dates)
  "assets": {
    "directory": "./website/dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*", "/robots.txt", "/sitemap.xml", "/sitemap-*.xml", "/*/story/*", "/*/lesson/*"]
  },
  "vars": { "NODE_ENV": "production", "CLIENT_URL": "https://quickstory.ai" }
}
```

*As-built note:* the OG catch-all in `server/index.ts` reads `index.html` from the `ASSETS` binding, which `server/worker.ts` hands over via `globalThis.__ASSETS__` (kept off a static `cloudflare:workers` import so `server/index.ts` still runs under local `nodemon`, where it falls back to reading `website/dist/index.html` from disk). Worker-only files (`worker.ts`, `env-shim.ts`) are excluded from the server `tsc` build in `server/tsconfig.json` — wrangler/esbuild compiles them.

---

## 6. Frontend changes — serving the Vite build

Almost nothing changes in the app; what changes is where `website/dist` is served from. The Vite build already emits a standard SPA. `website/vite.config.ts` currently sets `base` and uses `VITE_BASE_URL` to make assets load from the CDN host when the API build embeds them — under one origin that indirection is unnecessary; assets and API share a host, so `base: '/'` is correct and the per-service `VITE_BASE_URL` juggling goes away.

The Vite dev proxy in `website/vite.config.ts` (forwarding `/api` and the sitemap routes to `localhost:3001`) stays as-is for local development. Production no longer proxies — the Worker owns both. Build order for deploy: `cd website && vite build` produces `website/dist`, then `wrangler deploy` uploads the Worker + the `dist` assets together.

---

## 7. Image processing without `sharp`

`sharp` cannot run in a Worker. It is used only to shrink DALL·E output before upload, and only in admin-triggered generation. Because both call sites already upload the raw PNG when `sharp` is unavailable, the safe default is to **remove the `sharp` block from the Worker path and lean on Supabase's on-the-fly transforms for delivery** — the same transform mechanism `toOgImageUrl` already uses.

| Aspect | Approach |
|---|---|
| Stored original | Upload the DALL·E PNG (or a light re-encode) straight to the `creations` bucket. Larger at rest, but Supabase Storage is already the store and cost impact is small at this volume. |
| Display & OG delivery | Serve via Supabase render-transform URLs with `width`/`quality` params (generalize `toOgImageUrl` into a `toDisplayImageUrl(url, {width})` helper in `server/image_utils.ts`), so cards and social previews stay small on the wire. |
| Optional tighter storage | If storing 2–4MB originals is undesirable, resize with **Cloudflare Images** (a fetch-based transform, no native binary) at upload time, or keep the ≤500KB WebP guarantee. |
| Backfill / re-optimize | The existing `tools/fix_missing_images.ts` (and a re-compress variant per `design/creation-image-optimization.md` §4) runs **locally via `ts-node`, keeping `sharp`** — it never runs on the Worker, so no change is needed there. |

Net code change: delete the two `require('sharp')` blocks (Section 5 table), keep the upload logic, and route all image display through the transform helper. `sharp` moves out of `server/`'s runtime `dependencies`; it can remain a root/tools devDependency for the local scripts.

---

## 8. DNS, domains & cutover safety

The DNS/zone move is deliberately the **last** step, after everything is verified working (confirmed in review — Open decision 6). Sequence:

- Bring the Worker up on its `*.workers.dev` URL and run the full Section 10 checklist there, while Render still serves production and `quickstory.ai` DNS stays exactly where it is. All staging verification happens on `workers.dev` — no DNS change needed to test.
- Only once the checklist passes, **as the final cutover action**, move the `quickstory.ai` zone to Cloudflare DNS and point the apex/`www` at the Worker via a Workers **custom domain / route**. This also unlocks Cloudflare's CDN/WAF for the whole site.
- Point `api.quickstory.ai` at the same Worker (or a 301) for a deprecation window so any hardcoded/external references keep working, then retire it.
- Keep Render running until a full day of production traffic looks clean; decommission last. Because DNS moved last, rollback before that point is just leaving DNS untouched; rollback after is a DNS/route flip back.

---

## 9. Integration checklist (files to touch)

| File | Change |
|---|---|
| `wrangler.jsonc` (new, repo root) | Worker config: `main`, `compatibility_date`, `nodejs_compat_v2`, `assets` binding with `run_worker_first` + SPA fallback, `vars`. |
| `server/worker.ts` (new) | Worker entry: wrap `app` with `httpServerHandler`; optional `process.env` shim. |
| `server/dev.ts` (new) | Local-only `app.listen(PORT)`; wired to `npm run dev`. |
| `server/index.ts` | Remove `app.listen`; delete `getCdnIndexHtml`/cache; replace CDN fetch with `ASSETS` read in the OG catch-all; drop `express.static`/`distCandidates`; optionally trim CORS. |
| `server/routes.ts` (~L396–417) | Delete the `sharp` resize block; upload PNG; keep Supabase upload + DB update. |
| `server/generator.ts` (~L415–437) | Same `sharp` removal for batch generation. |
| `server/image_utils.ts` | Generalize `toOgImageUrl` → shared display/OG transform helper with `width`/`quality`. |
| `server/auth.ts` | Verify/adjust `COOKIE_DOMAIN` for single origin. |
| `website/vite.config.ts` | Set `base: '/'`; retire `VITE_BASE_URL` indirection (keep dev proxy). |
| `server/package.json` | Move `sharp` out of runtime deps; add `wrangler` (root) and `@cloudflare/workers-types`; adjust `dev`/`build`/`start` scripts. |
| `package.json` (root) | Replace `deploy` → `vite build && wrangler deploy` (or wire Cloudflare Workers Builds to the `prod` branch). |
| `tools/deploy.sh` | Repoint from the Render `prod`-branch flow to `wrangler deploy` / Workers Builds; or retire. |
| `README.md` / `CLAUDE.md` | Update run/deploy docs to the single-Worker flow. |
| `website/.env` | Split into Worker `[vars]` + `wrangler secret`; document the mapping. |

Frontend feature code, translations, the tests page, sitemap logic, and the Supabase schema are untouched.

---

## 10. Cutover verification checklist

Run against the staging Worker before flipping `quickstory.ai`, then again on production immediately after:

1. **SPA loads** at `/`, hashed assets 200 from Static Assets, deep-link refresh on a client route returns `index.html`.
2. **API** — `/health`, a `discovery` fetch, and an authenticated `/api/me` call succeed same-origin (no CORS error).
3. **Google login** — full sign-in sets the JWT cookie, `/auth/me` returns the user, admin email sees `isAdmin: true`, logout clears it.
4. **OG injection** — `curl` a `/he/story/:slug` and `/en/lesson/:slug` and confirm injected `<title>`/`og:*`/`twitter:*` tags and a Supabase-transform `og:image`; check a WhatsApp/X preview.
5. **SEO files** — `/robots.txt`, `/sitemap.xml`, and each per-language `sitemap-*-{en,he}.xml` return valid XML; legacy unprefixed routes still 301.
6. **Generator** — generate one story image end-to-end; confirm it lands in the `creations` bucket and `creations.image_url` updates; confirm display + OG transform URLs render.
7. **Tests page** — the in-app runner (`/api/tests`) passes.
8. **Old origin** — `api.quickstory.ai` still resolves during the deprecation window.

---

## 11. Risks & mitigations

**Express 5 / middleware gaps under `nodejs_compat`.** → `express.json`, `cors`, and `cookie-parser` are confirmed-working; pin `compatibility_date` and `nodejs_compat_v2`, and smoke-test the full stack on staging (the local `supertest` suite still exercises `app` directly). Keep the `server/dev.ts` `app.listen` path so local Node behavior is unchanged.

**Worker CPU/time limits on generation.** → DALL·E calls are long wall-clock but low CPU (mostly awaiting I/O), which Workers tolerate; still, batch generation (`BATCH_CONCURRENCY = 20` in `server/config.ts`) is the riskiest path. Mitigation: verify a single generation on staging first; if batch exceeds limits, run it as the existing local `tools` script or move it behind a Cloudflare Queue as a follow-up (out of scope here).

**Larger images at rest after dropping `sharp`.** → Deliver via Supabase transforms (already in use), optionally add Cloudflare Images, and run the local re-optimize tool once as backfill. Visual output is unchanged because delivery is transformed.

**SEO/OG regression during cutover.** → The OG path is exercised in the Section 10 checklist against staging before flip; sitemaps and 301s are preserved; `X-Robots-Tag: index, follow` header stays.

**Auth cookie breakage at origin change.** → Test the full Google flow on staging; keep `.quickstory.ai` cookie domain through cutover; only simplify to host-only after login is verified.

**`process.env` timing.** → `server/config.ts` runs `dotenv.config()` and reads env at import; add the `Object.assign(process.env, env)` shim in `server/worker.ts` before importing the app if any value reads empty in the Worker.

**Rollback.** → Render stays live and un-decommissioned until a full day of clean Cloudflare traffic; reverting is a DNS/route flip back.

---

## 12. Open decisions (defaults chosen — confirm or redirect)

1. **Image storage strategy.** *Default:* drop `sharp`, store the DALL·E PNG, and deliver everything through Supabase transforms. *Alternative:* add Cloudflare Images to keep ≤500KB WebP originals. → Confirm the default, or opt into Cloudflare Images.
2. **Deploy mechanism.** *Default:* Cloudflare **Workers Builds** watching the existing `prod` branch (mirrors today's Git-driven Render deploy, keeps `tools/deploy.sh`'s branch flow). *Alternative:* manual `wrangler deploy` from CI. → Confirm.
3. **`api.quickstory.ai` fate.** *Default:* keep it pointed at the same Worker for a deprecation window, then retire. → Confirm the window length, or drop it immediately.
4. **CORS allowlist.** *Default:* keep the existing `CLIENT_URL`-derived allowlist for any non-browser callers. *Alternative:* trim to same-origin only. → Confirm whether any external/server-to-server clients hit the API.
5. **OG resolver refactor.** *Context (asked in review):* today, story/lesson pages need real `<title>`/`og:*` tags for social/SEO bots, which the SPA can't provide client-side (bots don't run JS), so Express injects them in `buildPageHtml`. On Render the static site and API are *different origins*, so a Render rewrite rule proxies `/*/story/*` and `/*/lesson/*` over to `api.quickstory.ai` to reach that injector. `design/og_resolver_design.md` proposed two things: **Part 1** (Render-specific) collapsed the per-type rewrites into one catch-all and worked around a Render wildcard bug that mangled `/he/story/slug` into `/slug/story/slug` (the reason `server/index.ts` uses a loose regex today); **Part 2** was an Express resolver registry so new page types don't require editing `index.ts`. *Why Part 1 is obsolete after this migration:* with one Worker on one origin there is **no cross-origin proxy at all** — no `api.quickstory.ai` to rewrite to and no Render rewrite layer. `run_worker_first` hands the story/lesson HTML paths straight to the same-origin Express catch-all, the path arrives clean, and the wildcard bug and its loose-regex workaround simply disappear (the precise `^/([a-z]{2})/story/…` regex can be restored). So Part 1 has nothing left to configure. *Default:* defer Part 2 (it's a hosting-independent code cleanup) to its own change; this plan just drops the now-moot Part 1. → Confirm defer vs. fold Part 2 in while touching this code.
6. **DNS move.** ✅ *Resolved (round 1):* move the full `quickstory.ai` zone to Cloudflare for consolidation, but sequence it as the **last** step — verify everything on `workers.dev` first, then move DNS as the final cutover action (reflected in Section 8).
