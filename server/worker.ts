// worker.ts — Cloudflare Worker entry point.
//
// Runs the existing Express app on the Workers runtime via the Node-compat
// httpServerHandler shim. Static assets (website/dist) are served by the Static
// Assets layer per wrangler.jsonc; the paths listed in `run_worker_first` reach
// this Worker and are handled by Express.
//
// Order matters:
//   1. "./env-shim"  — populate process.env from Worker bindings (side-effect import, runs first).
//   2. expose the ASSETS binding on globalThis so index.ts's OG catch-all can read
//      the built index.html without importing "cloudflare:workers" (which would break
//      local `nodemon` dev, where that module doesn't exist).
//   3. import the Express app, start it listening on an in-Worker port, and bridge.
import "./env-shim";
import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";

// Make the Static Assets binding available to index.ts at request time.
// index.ts reads (globalThis as any).__ASSETS__ lazily inside the OG catch-all.
(globalThis as any).__ASSETS__ = (env as any).ASSETS;

// eslint-disable-next-line import/first
import app from "./index";

// The Node HTTP server must listen on a port inside the Worker; httpServerHandler
// bridges incoming Worker requests to it. The port is internal (not a public port).
const PORT = 8787;
app.listen(PORT);

const handler = httpServerHandler({ port: PORT });

// Let the in-app test suite (server/tests/*) send requests back into this Worker
// WITHOUT a network round-trip.
//
// A Worker cannot fetch its own public hostname: a subrequest to a Cloudflare-fronted
// host that routes back to a Worker returns an instant 522 (cloudflare/workerd#787).
// That is why every HTTP-based test reported "Expected 200, got 522" in production
// while passing locally, and why no TEST_BASE_URL value can fix it.
//
// Calling this handler's own fetch() reuses the same inbound bridge that serves real
// traffic, so Express sees a normal request and all middleware runs. See
// server/tests/self_request.ts. Only the test suite reads this.
(globalThis as any).__SELF_DISPATCH__ = (request: Request): Promise<Response> =>
    (handler as any).fetch(request, env, {
        waitUntil: (promise: Promise<unknown>) => { void promise; },
        passThroughOnException: () => { /* no-op */ },
    });

export default handler;
