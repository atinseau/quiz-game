/**
 * Minimal mock Strapi server for E2E tests.
 * Serves pack and question data from mock files on port 1337.
 * Started by Playwright globalSetup, stopped by globalTeardown.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCKS_DIR = join(__dirname, "..", "mocks", "data");

function loadMock(filename: string): string {
  return readFileSync(join(MOCKS_DIR, filename), "utf-8");
}

let server: ReturnType<typeof Bun.serve> | null = null;

export function startMockStrapi(port = 1337) {
  server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);

      // GET /api/question-packs
      if (url.pathname === "/api/question-packs") {
        return new Response(loadMock("packs.json"), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // GET /api/questions?filters[pack][slug][$eq]=xxx
      if (url.pathname === "/api/questions") {
        const slug =
          url.searchParams.get("filters[pack][slug][$eq]") ?? "pack-test";
        const filename = `questions-${slug}.json`;
        try {
          const data = loadMock(filename);
          return new Response(data, {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          return new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      }

      // GET /api/player/me — mock player sync
      if (url.pathname === "/api/player/me") {
        return new Response(
          JSON.stringify({ data: { id: 1, username: "testuser" } }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      }

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`[mock-strapi] Running on port ${port}`);
  return server;
}

export function stopMockStrapi() {
  if (server) {
    server.stop();
    server = null;
    console.log("[mock-strapi] Stopped");
  }
}
