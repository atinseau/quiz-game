import index from "./index.html";

const server = Bun.serve({
  port: 3000,
  routes: {
    "/": index,
  },
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname.match(/^\/questions(-\d+)?\.json$/)) {
      const filename = url.pathname.slice(1);
      return new Response(Bun.file("public/questions/" + filename), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (url.pathname === "/chunks") {
      const glob = new Bun.Glob("questions*.json");
      const files = [...glob.scanSync("public/questions")].sort();
      return Response.json(files);
    }

    if (url.pathname === "/packs.json") {
      const packs = await Bun.file("public/questions/packs.json").json();
      for (const pack of packs) {
        try {
          const data = await Bun.file("public/questions/" + pack.file).json();
          pack.questionCount = Object.values(data).flat().length;
        } catch {
          pack.questionCount = 0;
        }
      }
      return Response.json(packs);
    }

    if (url.pathname === "/win.mp3" || url.pathname === "/fail.mp3" || url.pathname === "/steal.mp3") {
      const filename = url.pathname.slice(1);
      return new Response(Bun.file("public/assets/" + filename), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Quiz app lancée sur http://localhost:${server.port}`);
