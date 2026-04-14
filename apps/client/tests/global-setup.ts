/**
 * Playwright global setup: starts mock Strapi server for multi-device tests.
 * The server-side game engine fetches questions from Strapi at localhost:1337.
 * The client-side mocks (page.route) only intercept browser requests.
 */

import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCKS_DIR = join(__dirname, "mocks", "data");

function loadMock(filename: string): string {
  return readFileSync(join(MOCKS_DIR, filename), "utf-8");
}

let server: Server | null = null;

export default function globalSetup() {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost:1337");

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    res.setHeader("Content-Type", "application/json");

    if (url.pathname === "/api/question-packs") {
      res.writeHead(200);
      res.end(loadMock("packs.json"));
      return;
    }

    if (url.pathname === "/api/questions") {
      const slug =
        url.searchParams.get("filters[pack][slug][$eq]") ?? "pack-test";
      const filename = `questions-${slug}.json`;
      try {
        const data = loadMock(filename);
        res.writeHead(200);
        res.end(data);
      } catch {
        res.writeHead(200);
        res.end('{"data":[]}');
      }
      return;
    }

    if (url.pathname.startsWith("/api/player")) {
      res.writeHead(200);
      res.end(JSON.stringify({ data: { id: 1, username: "testuser" } }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(1337, () => {
    console.log("[mock-strapi] Running on port 1337");
  });

  return () => {
    if (server) {
      server.close();
      server = null;
      console.log("[mock-strapi] Stopped");
    }
  };
}
