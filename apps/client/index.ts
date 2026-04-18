import index from "./index.html";
import { verifyClerkCookie } from "./src/server/auth";
import type { WsData } from "./src/server/types";
import { websocketHandlers } from "./src/server/ws";

const server = Bun.serve<WsData>({
  hostname: "0.0.0.0",
  port: 3000,
  routes: {
    "/": index,
    "/play": index,
    "/play/solo": index,
    "/play/create": index,
    "/play/join": index,
    "/play/lobby/*": index,
    "/game": index,
    "/end": index,
    "/join/*": index,
  },
  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const userData = await verifyClerkCookie(req);
      if (!userData) {
        return new Response("Unauthorized", { status: 401 });
      }
      const upgraded = server.upgrade(req, { data: userData });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // Audio files
    if (
      url.pathname === "/win.mp3" ||
      url.pathname === "/fail.mp3" ||
      url.pathname === "/steal.mp3"
    ) {
      const filename = url.pathname.slice(1);
      return new Response(Bun.file(`public/assets/${filename}`), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    }

    // PWA: manifest + service worker + icons
    if (url.pathname === "/manifest.webmanifest") {
      return new Response(Bun.file("public/manifest.webmanifest"), {
        headers: { "Content-Type": "application/manifest+json" },
      });
    }
    if (url.pathname === "/sw.js") {
      return new Response(Bun.file("public/sw.js"), {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-cache",
          "Service-Worker-Allowed": "/",
        },
      });
    }
    if (url.pathname.startsWith("/icons/")) {
      const file = Bun.file(`public${url.pathname}`);
      if (await file.exists()) return new Response(file);
    }

    // SPA fallback
    return new Response(Bun.file("index.html"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
  websocket: websocketHandlers,
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Quiz app lancée sur http://localhost:${server.port}`);
console.log(`Réseau local : http://${server.hostname}:${server.port}`);
