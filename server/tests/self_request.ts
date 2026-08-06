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

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

/**
 * Dispatch in-isolate, following redirects.
 *
 * A network fetch() follows redirects itself (redirect: "follow" is the default);
 * a raw handler.fetch() hands back the 3xx as-is. Without this, /sitemap-static.xml
 * and friends — which server/sitemap.ts 301s to their -en variants — return 301 and
 * the tests read an empty body.
 */
async function dispatchFollowingRedirects(
    dispatch: SelfDispatch,
    initial: Request,
    body: BodyInit | null | undefined,
): Promise<Response> {
    let current = initial;
    let response = await dispatch(current);

    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
        if (!REDIRECT_STATUSES.has(response.status)) return response;

        const location = response.headers.get("location");
        if (!location) return response;

        // Per the fetch spec: any 303, and a 301/302 on a non-GET, become a GET
        // with the body dropped. 307/308 replay the method and body unchanged.
        const dropsBody =
            response.status === 303 ||
            ((response.status === 301 || response.status === 302) &&
                current.method !== "GET" &&
                current.method !== "HEAD");

        const method = dropsBody ? "GET" : current.method;
        const headers = new Headers(current.headers);
        const replayBody = !dropsBody && method !== "GET" && method !== "HEAD" ? body : undefined;

        if (replayBody === undefined || replayBody === null) {
            headers.delete("content-length");
            headers.delete("content-type");
        }

        current = new Request(new URL(location, current.url).toString(), {
            method,
            headers,
            ...(replayBody !== undefined && replayBody !== null ? { body: replayBody } : {}),
        });
        response = await dispatch(current);
    }

    return response; // redirect cap hit — let the assertion report the 3xx
}

/**
 * Issue a request against this server. In-isolate on Workers, over the network
 * everywhere else. Drop-in replacement for `fetch(BASE_URL + path, init)`.
 */
export async function testFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${getTestBaseUrl()}${path}`;

    const dispatch = (globalThis as any).__SELF_DISPATCH__ as SelfDispatch | undefined;
    if (typeof dispatch !== "function") {
        // Local dev: a real HTTP request, which follows redirects on its own.
        return fetch(url, init);
    }

    const headers = new Headers((init.headers as HeadersInit) || {});

    // express.json() (body-parser) only parses a body when the request advertises
    // one via Content-Length or Transfer-Encoding. A Request constructed in-isolate
    // from a string carries neither, so req.body arrives `undefined` and schema
    // validation fails with "expected object, received undefined" on every POST.
    if (typeof init.body === "string" && !headers.has("content-length")) {
        headers.set("content-length", String(new TextEncoder().encode(init.body).byteLength));
    }

    return dispatchFollowingRedirects(dispatch, new Request(url, { ...init, headers }), init.body);
}
