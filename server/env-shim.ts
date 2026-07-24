// env-shim.ts — bridge Cloudflare Worker bindings onto process.env.
//
// On Workers, environment variables and secrets are exposed via
// `import { env } from "cloudflare:workers"`, NOT on process.env. The existing
// server code (config.ts, supabase.ts, auth.ts, routes.ts, …) reads process.env.*
// directly, so we copy the string-valued bindings across ONCE, before any of that
// code is imported.
//
// IMPORTANT: this file must be imported FIRST in server/worker.ts, above the
// `import app from "./index"` line, so process.env is populated before index.ts
// (and its transitive imports) read it at module-eval time.
//
// This module is Worker-only. It is never imported by server/dev.ts (local Node),
// where process.env is populated from website/.env by dotenv as before.
import { env } from "cloudflare:workers";

for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
  if (typeof value === "string" && process.env[key] === undefined) {
    process.env[key] = value;
  }
}
