# Comments on Cloudflare Migration Plan — review round 1

## Open decisions (defaults chosen — confirm or redirect)

- re: "OG resolver refactor. Default: out of scope — just delete the now-obsolete Render-rewrite half of design/og_resolver_design.md."
  why is this obsolete? what was it doing before? why is it not needed?
  → **Clarified — decision still open pending your confirm.** *The doc's OG injection gives story/lesson pages real `<title>`/`og:*` tags for bots. On Render the static site and API are different origins, so a Render rewrite proxies `/*/story/*` and `/*/lesson/*` to `api.quickstory.ai` to reach Express's `buildPageHtml`. Part 1 of the doc was Render-specific (collapse per-type rewrites into one catch-all + work around a Render wildcard bug that mangled the path — the reason `index.ts` uses a loose regex). After the migration there is no cross-origin proxy at all — `run_worker_first` hands those paths to the same-origin Express catch-all, the path arrives clean, and the wildcard bug + workaround disappear, so Part 1 has nothing left to configure. Part 2 (the resolver registry) is a hosting-independent code cleanup, still valid but optional. Expanded this in full under Open decision 5 and the Non-goals section. Default remains: drop the moot Part 1, defer Part 2. Confirm defer vs. fold Part 2 in.*

- re: "DNS move. Default: move the full quickstory.ai zone to Cloudflare (consolidation)."
  we'll do this as last step after we verify its all working
  → **✅ Accepted — DNS move confirmed, sequenced last.** *Keep the full-zone move to Cloudflare, but do it as the final cutover action after the Section 10 checklist passes on `workers.dev`. Updated the "DNS, domains & cutover safety" section to verify entirely on `workers.dev` first (no DNS change to test), then move the zone last, and marked Open decision 6 resolved.*

---

Round-1 items folded into `cloudflare-migration.md` and the `.html` regenerated to match. Decision 6 (DNS) is resolved; decision 5 (OG resolver) is clarified and awaits your confirm (defer Part 2 vs. include it). Decisions 1–4 remain open for round 2.
