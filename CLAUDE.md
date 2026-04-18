
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. HTML imports fully support React, CSS, Tailwind.

### UI Components

- Use **shadcn/ui** for all UI components. Add new components via CLI: `bunx shadcn@latest add <component>`
- Components live in `apps/client/src/components/ui/`
- Use the `@/` path alias (configured in tsconfig.json) for imports: `import { Button } from "@/components/ui/button"`
- Use **lucide-react** for icons
- Use **Tailwind CSS v4** with `@tailwindcss/postcss` for styling
- Theme CSS variables are in `apps/client/src/index.css`
- shadcn config is in `apps/client/components.json`

### Mobile / PWA safe areas

The app is a PWA installable on iOS/Android. `index.html` uses `viewport-fit=cover`, so content extends under the notch / Dynamic Island / home indicator. **Any element fixed to a screen edge or spanning the full width must respect `env(safe-area-inset-*)`**.

⚠️ **Tailwind v4 can't parse `env()` inside arbitrary `calc()` values** (e.g. `max-w-[calc(100%-env(safe-area-inset-left))]` silently fails and falls back to defaults). Use the dedicated utility classes defined in `apps/client/src/index.css` instead:

- **Padding**: `safe-pt` / `safe-pr` / `safe-pb` / `safe-pl` / `safe-px` / `safe-py` / `safe-p`
- **Margin**: `safe-mt` / `safe-mr` / `safe-mb` / `safe-ml`
- **Size**: `safe-max-w` / `safe-max-h` (optional extra gutter via inline `style={{ "--gutter": "1rem" }}`)
- **Dialog-specific**: `.dialog-safe-area` (already applied in `components/ui/dialog.tsx`)

Rules of thumb:
- `fixed top-0` / header → add `safe-pt safe-px`
- `fixed bottom-0` / bottom nav / sticky CTA → add `safe-pb safe-px`
- Full-viewport layouts → `safe-p` on the outer container
- Custom modals or full-screen sheets → `safe-max-w safe-max-h` + `overflow-y-auto`

If you need a new safe-area variant, add it to `index.css` as a real CSS class — **do not** inline `env()` inside Tailwind arbitrary values.

### Server

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
