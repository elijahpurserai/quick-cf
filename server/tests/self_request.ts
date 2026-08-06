/**
 * How the in-app test suite issues its HTTP requests.
 *
 * The test runner executes *inside* the server, so every test is a self-request.
 * That is straightforward on local Node and impossible over the network on
 * Cloudflare Workers:
 *
 *   A Worker cannot fetch its own public hostname. A subrequest to a
 *   Cloudflare-fronted host that routes back to a Worker returns an *instant*
 *   522 (cloudflare/workerd#787, workers-sdk#2659). It is not a URL problem —
 *   the workers.dev URL serves fine from the outside world; only the loop back
 *   into the same Worker is refused. Pointing TEST_BASE_URL at quickstory.ai
 *   instead fails identically.
 *
 *   Symptom when this bites: every HTTP-based assertion reports
 *   "Expected 200, got 522", while the Content Generation category (which calls
 *   OpenAI directly and never self-requests) passes.
 *
 * So on Workers we skip the network entirely and hand the request straight back
 * into the Worker's own inbound bridge, in-isolate: server/worker.ts exposes
 * `globalThis.__SELF_DISPATCH__`, which is the same httpServerHandler fetch()
 * that serves real traffic. Express sees a normal request, all middleware runs.
 *
 * Local dev has no __SELF_DISPATCH__, so this falls through to a plain fetch()
 * against localhost — unchanged behavior.
 *
 * KNOWN LIMIT: dispatching in-isolate enters the Worker directly, so it does not
 * exercise Cloudflare's static-asset layer. A path missing from `run_worker_first`
 * in wrangler.jsonc will pass here but still be served as the bare SPA shell to
 * real bots. Keep that list in sync with server/seo_prerender.ts by hand.
 */

/** Absolute origin used to build request URLs (Request requires an absolute URL). */
export function getTestBaseUrl(): string {
    const stripTrailing = (url: string) => url.replace(/\/+$/, "");

    const explicit = process.env.TEST_BASE_URL;
    if (explicit) return stripTrailing(explicit);

    const clientUrl = (process.env.CLIENT_URL || "").split(",")[0].trim();
    if (clientUrl) return stripTrailing(clientUrl);

    return `http://localhost:${process.env.PORT || 3001}`;
}

type SelfDispatch = (request: Request) => Promise<Response>;

/**
 * Issue a request against this server. In-isolate on Workers, over the network
 * everywhere else. Drop-in replacement for `fetch(BASE_URL + path, init)`.
 */
export async function testFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${getTestBaseUrl()}${path}`;

    const dispatch = (globalThis as any).__SELF_DISPATCH__ as SelfDispatch | undefined;
    if (typeof dispatch === "function") {
        return dispatch(new Request(url, init));
    }

    return fetch(url, init);
}
