import index from "./index.html";
import { verifyClerkCookie } from "./src/server/auth";
import type { WsData } from "./src/server/types";
import { websocketHandlers } from "./src/server/ws";

const server = Bun.serve<WsData>({
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
