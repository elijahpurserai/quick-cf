// dev.ts — local development entry point (plain Node, via `npm run dev`).
//
// The Worker entry (worker.ts) is NOT used locally. Here we just import the same
// Express app and listen on the dev port, exactly as the old index.ts did. env vars
// come from website/.env via dotenv (loaded inside config.ts's import chain), so no
// env-shim is needed. The OG catch-all in index.ts falls back to reading
// website/dist/index.html from disk because globalThis.__ASSETS__ is undefined here.
import app from "./index";

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`[dev] Server is running on http://localhost:${PORT}`);
});
