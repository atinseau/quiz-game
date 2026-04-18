const result = await Bun.build({
  entrypoints: ["./src/sw.ts"],
  outdir: "./public",
  naming: "sw.js",
  target: "browser",
  format: "esm",
  minify: process.env.NODE_ENV === "production",
});

if (!result.success) {
  console.error("Service worker build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log("Service worker built → public/sw.js");
