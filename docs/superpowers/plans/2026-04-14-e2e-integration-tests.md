# E2E Integration Tests — Full Stack, No Mocks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Playwright tests against the real Strapi backend + real client, zero mocks, with DB snapshot/rollback between tests.

**Architecture:** Playwright config at monorepo root, Strapi with isolated test DB (`.tmp/test.db`), SQL seed file for deterministic state, `better-sqlite3` for snapshot/restore.

**Tech Stack:** Playwright, better-sqlite3, Bun, Strapi v5

---

## Strategy

```
playwright.config.ts (root)
│
├── globalSetup
│   1. Delete .tmp/test.db if exists
│   2. Start Strapi with DATABASE_FILENAME=.tmp/test.db
│   3. Wait for Strapi ready (poll /api/question-packs)
│   4. Inject seed.sql via better-sqlite3
│   5. Snapshot: copy test.db → test.db.snapshot
│   6. Start client (bun --hot apps/client/index.ts)
│   7. Wait for client ready (poll http://localhost:3000)
│
├── beforeEach (fixture)
│   1. fs.copyFileSync(test.db.snapshot → test.db)   ~10ms
│
├── tests run against real servers
│
└── globalTeardown
    1. Kill Strapi + client processes
    2. Delete test.db + test.db.snapshot
```

**Key insight:** Strapi's `DATABASE_FILENAME` env var lets us use a completely separate DB file for tests. The dev DB (`.tmp/data.db`) is never touched.

---

## File Structure

### New files

```
playwright.config.ts                          — root config for integration tests
tests/
  integration/
    global-setup.ts                           — start Strapi + client, seed, snapshot
    global-teardown.ts                        — kill processes, cleanup
    fixtures.ts                               — DB restore fixture + helpers
    seed.sql                                  — deterministic test data (INSERT statements)
    specs/
      smoke.spec.ts                           — basic: packs load, game starts
      classic-flow.spec.ts                    — full classic game against real data
      pack-selection.spec.ts                  — pack grid, search, completion badges
```

### Modified files

```
package.json                                  — add "e2e:integration" script
```

---

## Task 1: SQL Seed File

**Files:**
- Create: `tests/integration/seed.sql`

- [ ] **Step 1: Examine Strapi's SQLite schema**

Start Strapi once to generate the schema, then dump table names:

```bash
cd apps/backend && DATABASE_FILENAME=.tmp/test-schema.db bun run develop &
# Wait for startup, then Ctrl+C
sqlite3 .tmp/test-schema.db ".schema question_packs"
sqlite3 .tmp/test-schema.db ".schema categories"
sqlite3 .tmp/test-schema.db ".schema questions"
sqlite3 .tmp/test-schema.db ".schema categories_packs_lnk"
```

- [ ] **Step 2: Write seed.sql with minimal test data**

Create `tests/integration/seed.sql` with:
- 2 packs (one with 6 questions, one with 3 questions — enough to test a full game)
- 3 categories (shared and unique)
- 9 questions total (mix of qcm, vrai_faux, texte)
- Link table entries (categories_packs_lnk)
- Public role permissions (so the API works without manual config)

The SQL must use the exact column names from Strapi's auto-generated schema. Use explicit IDs for deterministic foreign keys.

```sql
-- tests/integration/seed.sql
-- Packs
INSERT INTO question_packs (id, document_id, slug, name, description, icon, gradient, is_free, published, display_order, created_at, updated_at)
VALUES
  (1, 'pack-test-1', 'pack-test', 'Pack Test', 'Pack de test', '🧪', 'from-green-500 to-blue-500', 1, 1, 0, datetime('now'), datetime('now')),
  (2, 'pack-test-2', 'pack-test-2', 'Pack Test 2', 'Deuxième pack', '🔬', 'from-red-500 to-orange-500', 1, 1, 1, datetime('now'), datetime('now'));

-- Categories
INSERT INTO categories (id, document_id, slug, name, created_at, updated_at)
VALUES
  (1, 'cat-geo', 'geographie', 'Géographie', datetime('now'), datetime('now')),
  (2, 'cat-sci', 'sciences', 'Sciences', datetime('now'), datetime('now')),
  (3, 'cat-hist', 'histoire', 'Histoire', datetime('now'), datetime('now'));

-- ... questions, link tables, permissions
```

**Important:** The exact column names and table names come from Step 1. Don't guess — read the actual schema.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/seed.sql
git commit -m "test: add SQL seed file for integration tests"
```

---

## Task 2: Playwright Config at Root

**Files:**
- Create: `playwright.config.ts` (monorepo root)

- [ ] **Step 1: Create the config**

```ts
// playwright.config.ts (root)
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/integration/specs",
  fullyParallel: false, // sequential — shared DB
  retries: 0,
  workers: 1, // single worker — shared DB
  reporter: [["html", { outputFolder: "test-results/integration" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "integration",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  globalSetup: "./tests/integration/global-setup.ts",
  globalTeardown: "./tests/integration/global-teardown.ts",
  // No webServer — we manage Strapi + client ourselves in globalSetup
});
```

- [ ] **Step 2: Add script to root package.json**

```json
"e2e:integration": "bunx playwright test --config playwright.config.ts"
```

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts package.json
git commit -m "test: add root Playwright config for integration tests"
```

---

## Task 3: Global Setup & Teardown

**Files:**
- Create: `tests/integration/global-setup.ts`
- Create: `tests/integration/global-teardown.ts`

- [ ] **Step 1: Write global-setup.ts**

```ts
// tests/integration/global-setup.ts
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { copyFileSync, existsSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const ROOT = join(import.meta.dirname, "..", "..");
const BACKEND_DIR = join(ROOT, "apps", "backend");
const CLIENT_DIR = join(ROOT, "apps", "client");
const DB_PATH = join(BACKEND_DIR, ".tmp", "test.db");
const SNAPSHOT_PATH = join(BACKEND_DIR, ".tmp", "test.db.snapshot");
const SEED_SQL = join(import.meta.dirname, "seed.sql");

const STRAPI_PORT = 1337;
const CLIENT_PORT = 3000;

let strapiProcess: ChildProcess;
let clientProcess: ChildProcess;

async function waitForReady(url: string, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

export default async function globalSetup() {
  // 1. Clean up old test DB
  if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
  if (existsSync(DB_PATH + "-wal")) unlinkSync(DB_PATH + "-wal");
  if (existsSync(DB_PATH + "-shm")) unlinkSync(DB_PATH + "-shm");

  // 2. Start Strapi with test DB
  strapiProcess = spawn("bun", ["run", "develop"], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      DATABASE_FILENAME: ".tmp/test.db",
      NODE_ENV: "development",
    },
    stdio: "pipe",
  });

  // 3. Wait for Strapi ready
  await waitForReady(`http://localhost:${STRAPI_PORT}/api/question-packs`);

  // 4. Inject seed SQL
  const sql = readFileSync(SEED_SQL, "utf-8");
  const db = new Database(DB_PATH);
  db.exec(sql);
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  // 5. Snapshot
  copyFileSync(DB_PATH, SNAPSHOT_PATH);

  // 6. Start client
  clientProcess = spawn("bun", ["--hot", "index.ts"], {
    cwd: CLIENT_DIR,
    env: { ...process.env },
    stdio: "pipe",
  });

  // 7. Wait for client ready
  await waitForReady(`http://localhost:${CLIENT_PORT}`);

  // Store process refs for teardown
  (globalThis as any).__STRAPI_PROCESS = strapiProcess;
  (globalThis as any).__CLIENT_PROCESS = clientProcess;
}
```

- [ ] **Step 2: Write global-teardown.ts**

```ts
// tests/integration/global-teardown.ts
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const BACKEND_DIR = join(ROOT, "apps", "backend");
const DB_PATH = join(BACKEND_DIR, ".tmp", "test.db");
const SNAPSHOT_PATH = join(BACKEND_DIR, ".tmp", "test.db.snapshot");

export default async function globalTeardown() {
  // Kill processes
  const strapi = (globalThis as any).__STRAPI_PROCESS;
  const client = (globalThis as any).__CLIENT_PROCESS;
  if (strapi) strapi.kill("SIGTERM");
  if (client) client.kill("SIGTERM");

  // Cleanup test DB files
  for (const f of [DB_PATH, SNAPSHOT_PATH, DB_PATH + "-wal", DB_PATH + "-shm"]) {
    if (existsSync(f)) unlinkSync(f);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/global-setup.ts tests/integration/global-teardown.ts
git commit -m "test: add global setup/teardown for integration tests"
```

---

## Task 4: Test Fixtures (DB Restore)

**Files:**
- Create: `tests/integration/fixtures.ts`

- [ ] **Step 1: Write fixtures.ts**

```ts
// tests/integration/fixtures.ts
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";

const ROOT = join(import.meta.dirname, "..", "..");
const BACKEND_DIR = join(ROOT, "apps", "backend");
const DB_PATH = join(BACKEND_DIR, ".tmp", "test.db");
const SNAPSHOT_PATH = join(BACKEND_DIR, ".tmp", "test.db.snapshot");

// Restore DB to seed state before each test
export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    // Restore DB snapshot
    copyFileSync(SNAPSHOT_PATH, DB_PATH);

    // Navigate to app
    await page.goto("/");
    await use(page);
  },
});

export { expect };

// --- Helpers (no mocks — interact with real UI) ---

export async function selectPack(page: Page, name: string) {
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await page.getByPlaceholder("Nom du joueur").waitFor();
}

export async function addPlayers(page: Page, players: string[]) {
  const input = page.getByPlaceholder("Nom du joueur");
  for (const name of players) {
    await input.fill(name);
    await page.getByRole("button", { name: "Homme", exact: true }).click();
    await page.getByRole("button", { name: "Ajouter" }).click();
  }
}

export async function goToModeSelection(page: Page) {
  await page.getByRole("button", { name: "Choisir le mode de jeu" }).click();
  await page.getByText("Choisis un mode de jeu").waitFor();
}

export async function startMode(
  page: Page,
  mode: "Classique" | "Voleur" | "Contre la montre",
) {
  await page.getByRole("button", { name: new RegExp(mode) }).click();
  await page.waitForURL("**/game");
}

export async function setupGame(
  page: Page,
  opts: {
    players: string[];
    mode: "Classique" | "Voleur" | "Contre la montre";
    pack?: string;
  },
) {
  await selectPack(page, opts.pack ?? "Pack Test");
  await addPlayers(page, opts.players);
  await goToModeSelection(page);
  await startMode(page, opts.mode);
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/integration/fixtures.ts
git commit -m "test: add integration test fixtures with DB restore"
```

---

## Task 5: Smoke Test

**Files:**
- Create: `tests/integration/specs/smoke.spec.ts`

- [ ] **Step 1: Write the smoke test**

This test validates the full stack works — packs loaded from real Strapi, no mocks.

```ts
// tests/integration/specs/smoke.spec.ts
import { test, expect } from "../fixtures";

test.describe("Smoke — full stack", () => {
  test("packs load from Strapi", async ({ app }) => {
    // Wait for packs to render (fetched from real Strapi API)
    await expect(app.getByText("Pack Test")).toBeVisible({ timeout: 10000 });
    await expect(app.getByText("Pack Test 2")).toBeVisible();
  });

  test("can select a pack and see player setup", async ({ app }) => {
    await app.getByRole("button", { name: /Pack Test/ }).first().click();
    await expect(app.getByPlaceholder("Nom du joueur")).toBeVisible();
  });

  test("can start a game with real questions", async ({ app }) => {
    // Setup
    await app.getByRole("button", { name: /Pack Test/ }).first().click();
    const input = app.getByPlaceholder("Nom du joueur");
    await input.fill("Alice");
    await app.getByRole("button", { name: "Homme", exact: true }).click();
    await app.getByRole("button", { name: "Ajouter" }).click();
    await app.getByRole("button", { name: "Choisir le mode de jeu" }).click();
    await app.getByRole("button", { name: /Classique/ }).click();

    // Should be on /game with a real question from the DB
    await app.waitForURL("**/game");
    // A question text should be visible (we don't know the exact text — it's from seed.sql)
    await expect(app.locator("p.text-xl")).toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Step 2: Run the test**

```bash
bun run e2e:integration
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/specs/smoke.spec.ts
git commit -m "test: add smoke integration test — full stack, no mocks"
```

---

## Task 6: Classic Flow Test

**Files:**
- Create: `tests/integration/specs/classic-flow.spec.ts`

- [ ] **Step 1: Write the test**

Unlike the mocked E2E tests, we don't know question order (shuffled). The test must be resilient — detect question type, answer based on what's visible, and verify scoring logic.

```ts
// tests/integration/specs/classic-flow.spec.ts
import { test, expect, setupGame } from "../fixtures";

test.describe("Classic mode — real data", () => {
  test("complete a solo game and reach end screen", async ({ app }) => {
    await setupGame(app, { players: ["Alice"], mode: "Classique", pack: "Pack Test" });

    // Answer all questions (we don't know the exact content — just interact with whatever appears)
    let questionCount = 0;
    const maxQuestions = 20; // safety limit

    while (questionCount < maxQuestions) {
      // Check if we're on the end screen
      if (app.url().includes("/end")) break;

      // Wait for question to appear
      const questionVisible = await app.locator("p.text-xl").isVisible().catch(() => false);
      if (!questionVisible) break;

      // Detect and answer (always pick first choice for QCM, "Vrai" for VF, type "test" for texte)
      const vraiFauxBtn = app.getByRole("button", { name: "Vrai", exact: true });
      const texteInput = app.getByPlaceholder("Votre reponse...");

      if (await vraiFauxBtn.isVisible().catch(() => false)) {
        await vraiFauxBtn.click();
      } else if (await texteInput.isVisible().catch(() => false)) {
        await texteInput.fill("test");
        await texteInput.press("Enter");
      } else {
        // QCM — click first choice
        const firstChoice = app.locator(".grid button").first();
        if (await firstChoice.isVisible().catch(() => false)) {
          await firstChoice.click();
        }
      }

      // Wait for feedback then next question
      await app.waitForTimeout(500);
      const nextBtn = app.getByRole("button", { name: "Question suivante" });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
      }

      questionCount++;
    }

    // Should reach end screen
    await expect(app).toHaveURL(/\/end/);
    // Score should be displayed
    await expect(app.locator("text=pts")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
bun run e2e:integration
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/specs/classic-flow.spec.ts
git commit -m "test: add classic flow integration test with real questions"
```

---

## Notes

### Evolving seed.sql

When new features need test data (e.g., paid packs, player profiles, game sessions), add INSERT statements to `seed.sql`. The file grows with the app. Keep it organized by sections:

```sql
-- ============================================
-- PACKS
-- ============================================
INSERT INTO ...

-- ============================================
-- CATEGORIES
-- ============================================
INSERT INTO ...

-- ============================================
-- QUESTIONS
-- ============================================
INSERT INTO ...

-- ============================================
-- PERMISSIONS (public API access)
-- ============================================
INSERT INTO ...
```

### Why 1 worker, sequential

Multiple workers would need multiple DB files + multiple Strapi instances. Overkill for now. If tests get slow (>30), we can switch to Option C (DB per worker) later.

### No auth in integration tests (for now)

Clerk auth is mocked at the route level (Clerk JS skipped). When Phase 2 adds mandatory auth, we'll add a test user in seed.sql and a Clerk test token strategy.
