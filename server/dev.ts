// dev.ts — local development entry point (plain Node, via `npm run dev`).
//
// The Worker entry (worker.ts) is NOT used locally. Here we load website/.env, then start
// the same Express app on the dev port. index.ts no longer loads dotenv itself (that would
// reference __dirname, which is undefined in the Workers runtime), so env loading lives here
// for local dev and in server/env-shim.ts for the Worker.
import dotenv from "dotenv";
import path from "path";

// Load website/.env BEFORE the app is imported, because modules like supabase.ts read
// process.env at import time. `require` (not `import`) is used for ./index so it runs AFTER
// this dotenv.config call rather than being hoisted above it by the module loader.
dotenv.config({ path: path.resolve(__dirname, "../website/.env") });

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require("./index").default;

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`[dev] Server is running on http://localhost:${PORT}`);
});
