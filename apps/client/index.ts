import index from "./index.html";

const server = Bun.serve({
  port: 3000,
  routes: {
    "/": index,
    "/play": index,
    "/game": index,
    "/end": index,
  },
  async fetch(req) {
    const url = new URL(req.url);

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

    // SPA fallback: serve index.html for all non-API routes (React Router handles client-side routing)
    return new Response(Bun.file("index.html"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Quiz app lancée sur http://localhost:${server.port}`);
