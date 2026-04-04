import { existsSync, statSync, readFileSync } from "fs";
import { join, extname } from "path";
import { route, matchRoute } from "./router.js";
import { listDecks, getDeck, deleteDeck } from "./api/decks.js";
import { submitReview } from "./api/reviews.js";
import { todayStats, heatmapData, deckStats } from "./api/stats.js";
import { getUser, updateUser } from "./api/user.js";
import { getConfig, updateConfig } from "./api/config.js";
import { importMarkdownDeck } from "./importers/markdown.js";
import { getStudyQueue } from "./fsrs/scheduler.js";
import { DATA_DIR } from "./db/connection.js";
import { jsonResponse } from "./json.js";

// --- register routes ---

route("GET", "/api/decks", () => listDecks());
route("GET", "/api/decks/:id", (_req, p) => getDeck(Number(p.id)));
route("DELETE", "/api/decks/:id", (_req, p) => deleteDeck(Number(p.id)));

route("POST", "/api/import/markdown", async (req) => {
  const { path } = await req.json();
  if (!path || !existsSync(path)) {
    return jsonResponse({ error: "Invalid path" }, 400);
  }
  const deckId = await importMarkdownDeck(path);
  return jsonResponse({ deckId });
});

route("GET", "/api/study/:deckId", (_req, p) => {
  const queue = getStudyQueue(Number(p.deckId));
  return jsonResponse(queue);
});

route("POST", "/api/review", (req) => submitReview(req));

route("GET", "/api/stats/today", () => todayStats());
route("GET", "/api/stats/heatmap", () => heatmapData());
route("GET", "/api/stats/deck/:id", (_req, p) => deckStats(Number(p.id)));

route("GET", "/api/user", () => getUser());
route("PATCH", "/api/user", (req) => updateUser(req));

route("GET", "/api/config", () => getConfig());
route("GET", "/api/config/:deckId", (_req, p) => getConfig(Number(p.deckId)));
route("PATCH", "/api/config", (req) => updateConfig(req));
route("PATCH", "/api/config/:deckId", (req, p) => updateConfig(req, Number(p.deckId)));

// --- MIME types ---
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

// --- server ---
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === "production";
const CLIENT_DIST = join(import.meta.dir, "../client/dist");

Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    // API routes
    const matched = matchRoute(req.method, pathname);
    if (matched) {
      try {
        return await matched.handler(req, matched.params);
      } catch (err: any) {
        console.error(`API error: ${req.method} ${pathname}`, err);
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // media file serving
    if (pathname.startsWith("/media/")) {
      const parts = pathname.slice(7).split("/");
      if (parts.length >= 2) {
        const filePath = join(DATA_DIR, "media", ...parts);
        if (existsSync(filePath)) {
          const ext = extname(filePath);
          return new Response(readFileSync(filePath), {
            headers: { "Content-Type": MIME[ext] ?? "application/octet-stream" },
          });
        }
      }
      return new Response("Not found", { status: 404 });
    }

    // static file serving (production)
    if (IS_PROD) {
      let filePath = join(CLIENT_DIST, pathname === "/" ? "index.html" : pathname);
      if (!existsSync(filePath)) {
        // SPA fallback
        filePath = join(CLIENT_DIST, "index.html");
      }
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = extname(filePath);
        return new Response(readFileSync(filePath), {
          headers: { "Content-Type": MIME[ext] ?? "application/octet-stream" },
        });
      }
    }

    // dev mode: let Vite handle non-API requests
    return new Response("Not found", { status: 404 });
  },
});

console.log(`ankimo server running on http://localhost:${PORT}`);
