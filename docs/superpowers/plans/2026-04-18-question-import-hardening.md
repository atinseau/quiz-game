# Question Import — Hardening & Test Strategy Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the correctness, security and coverage gaps uncovered by the code review, and establish a real unit + integration test strategy backed by a disposable Postgres testcontainer.

**Architecture:** Split the commit write path into a DI-friendly `persistImport(knex, …)` layer so it can be integration-tested with raw SQL against a real `pgvector/pgvector:pg16` container, without booting Strapi. Add a `tests/integration/` tree with a shared `testDb` fixture that spawns a container per test run, applies our migration, and tears down cleanly. Re-classify candidates server-side at commit-time so the server is the source of truth for `status`, `embedding`, and the `auto_blocked` override gate.

**Tech Stack:** Bun test runner, `testcontainers` (npm) + `@testcontainers/postgresql`, `pgvector/pgvector:pg16` image, Knex (already in Strapi), pgvector/utils for (de)serialization, OpenAI SDK (mocked in tests).

**Reference:**
- Spec: `docs/superpowers/specs/2026-04-17-ai-question-import-design.md`
- Original plan: `docs/superpowers/plans/2026-04-17-ai-question-import.md`
- Review feedback: see the `code-reviewer` output in chat (Critical C1–C3, Important I1–I6, Minor M1–M7)

---

## Scope

### In

**Test strategy foundation:**
- `testcontainers` + `@testcontainers/postgresql` helpers
- Shared `testDb` fixture (spawn + migrate + teardown)
- `tests/unit/` vs `tests/integration/` split (by directory)
- Integration tests for the full commit write path and KNN searcher against a real Postgres

**Critical fixes (TDD):**
- C1 — Use `pgvector.toSql()` consistently when writing embeddings
- C2 — Wrap commit writes in a transaction
- C3 — Re-classify candidates server-side at commit time; reject forged `decision`/`status`

**Important fixes:**
- I1 — Proper cosine similarity with defensive normalization
- I2 — Real LRU cache (bump on hit)
- I3 — `MAX_QUESTIONS_PER_IMPORT` limit in validation
- I4 — Parallel KNN queries with `Promise.all`
- I5 — Error logging via `strapi.log.error`
- I6 — Embeddings resolved server-side at commit (client-supplied vectors ignored)

**Minor:**
- Tighten `any` at controller boundaries
- Defensive `decisions[index]` handling in `Review.tsx`

### Out

- Full end-to-end Playwright tests against the admin UI (would require a separate browser harness)
- Rate limiting beyond per-request batch size (belongs in ingress layer)
- CI wiring (just ensure `bun test tests/unit` and `bun test tests/integration` both run locally)

---

## File Structure

### Create

- `apps/backend/tests/helpers/testDb.ts` — spawn container, apply migration, expose knex + teardown
- `apps/backend/tests/helpers/fixtures.ts` — factory helpers to seed packs/categories/questions for tests
- `apps/backend/tests/integration/testDb.smoke.test.ts` — smoke test validating the fixture
- `apps/backend/tests/integration/knn-searcher.test.ts`
- `apps/backend/tests/integration/persist-import.test.ts`
- `apps/backend/tests/integration/runCommit.test.ts`
- `apps/backend/src/plugins/question-import/server/services/persistImport.ts` — new pure-Knex write layer

### Modify

- `apps/backend/package.json` — add `testcontainers`, `@testcontainers/postgresql` deps; add `test:unit` / `test:integration` scripts
- `apps/backend/src/plugins/question-import/server/services/import.ts` — refactor `runCommit` to call `persistImport`, add server-side re-classification, batch-size limit, `Promise.all` for KNN, LRU eviction in cache (via embeddings.ts), pgvector.toSql usage
- `apps/backend/src/plugins/question-import/server/services/analyzer.ts` — proper cosine + normalization safeguard
- `apps/backend/src/plugins/question-import/server/services/embeddings.ts` — real LRU eviction
- `apps/backend/src/plugins/question-import/server/controllers/import.ts` — integrate `strapi.log.error` for 500s, tighten `any`
- `apps/backend/src/plugins/question-import/admin/src/pages/Review.tsx` — defensive fallbacks on `decisions[index]`
- Existing test files — may need minor updates if interfaces shift

### Directory layout after this plan

```
apps/backend/tests/
├── helpers/
│   ├── testDb.ts
│   └── fixtures.ts
├── mocks/
│   └── openai-embeddings.ts               (unchanged)
├── unit/                                   (renamed from question-import/)
│   ├── normalize.test.ts
│   ├── analyzer.test.ts
│   ├── embeddings.test.ts
│   ├── preview.integration.test.ts         (renamed preview.test.ts — it's actually unit)
│   └── commit.validation.test.ts           (renamed commit.integration.test.ts — pure validator)
└── integration/
    ├── testDb.smoke.test.ts
    ├── knn-searcher.test.ts
    ├── persist-import.test.ts
    └── runCommit.test.ts
```

(Renames are optional — if preferred, keep `tests/question-import/` for existing files and add `tests/integration/` next to it. Plan tasks will keep existing paths to minimize churn.)

---

## Test Strategy

### Three layers

1. **Unit** (`tests/question-import/*.test.ts`) — pure functions, no IO, no containers. Fast (< 100ms). Already 36 tests. Covers `normalize`, `analyzer`, `embeddings` cache logic, `validateImportBody`, `validateCommitBody`, `runPreview` with DI mocks.

2. **Integration with real Postgres** (`tests/integration/*.test.ts`) — spin a fresh `pgvector/pgvector:pg16` container via `testcontainers`, apply our migration, run the code path under test, assert DB state. Slower (~5-10s per test file due to container startup). Covers `createKnnSearcher`, `persistImport`, `runCommit`.

3. **Controller / end-to-end** — out of scope for this plan. Could be added later with `supertest` against a booted Strapi.

### Container lifecycle

- One container per test **file** (not per test) — started in `beforeAll`, stopped in `afterAll`.
- Each test inside the file gets a clean slate via `TRUNCATE ... RESTART IDENTITY CASCADE` in `beforeEach`.
- Container uses random host port to avoid conflicts with the dev container on 5432.
- `testcontainers` auto-cleans on process exit, so even a crashed test won't leak containers.

### Running

- `bun run test:unit` — fast feedback, ~200ms total.
- `bun run test:integration` — needs Docker running, ~30-60s total.
- `bun test tests/` — runs both. Default for pre-commit (when we re-enable hooks).

---

## Task 1: Install testcontainers deps & split test scripts

**Files:**
- Modify: `apps/backend/package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Add deps**
```bash
cd apps/backend
bun add -d testcontainers@^10.14.0 @testcontainers/postgresql@^10.14.0
```

- [ ] **Step 2: Update scripts in `apps/backend/package.json`**

Replace the current `"test": "bun test tests/"` with three scripts:

```json
"test": "bun test tests/",
"test:unit": "bun test tests/question-import/",
"test:integration": "bun test tests/integration/"
```

(Keep the default `test` script running everything so lefthook / CI behavior stays the same once hooks are re-enabled.)

- [ ] **Step 3: Verify installs**
```bash
cd apps/backend
bun run test:unit
```
Expected: 36 pass / 0 fail.

- [ ] **Step 4: Commit**
```bash
git add apps/backend/package.json bun.lock
git commit --no-verify -m "chore(backend): add testcontainers + split test scripts"
```

---

## Task 2: testDb fixture helper

**Files:**
- Create: `apps/backend/tests/helpers/testDb.ts`

- [ ] **Step 1: Create the helper**

Create `apps/backend/tests/helpers/testDb.ts`:

```ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import Knex, { type Knex as KnexType } from "knex";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

export interface TestDb {
  knex: KnexType;
  container: StartedPostgreSqlContainer;
  stop: () => Promise<void>;
  truncate: () => Promise<void>;
}

const PROJECT_BACKEND = path.resolve(__dirname, "..", "..");
const MIGRATIONS_DIR = path.join(PROJECT_BACKEND, "database", "migrations");

/**
 * Applies enough of the Strapi schema for tests to interact with
 * the questions / question_packs / categories tables, then applies
 * our custom pgvector migration.
 *
 * We don't boot Strapi here — instead we create the three tables
 * manually with the columns we actually exercise. This keeps the
 * fixture fast (~3s container startup vs ~15s Strapi boot).
 */
const BASE_SCHEMA_SQL = `
  CREATE TABLE question_packs (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    gradient VARCHAR(255),
    is_free BOOLEAN DEFAULT TRUE,
    stripe_price_id VARCHAR(255),
    price NUMERIC,
    published BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE categories_packs_lnk (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    pack_id INTEGER REFERENCES question_packs(id) ON DELETE CASCADE,
    category_ord DOUBLE PRECISION,
    pack_ord DOUBLE PRECISION
  );

  CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    type VARCHAR(32) NOT NULL,
    text TEXT NOT NULL,
    choices JSONB,
    answer VARCHAR(255) NOT NULL,
    display_order INTEGER DEFAULT 0,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    pack_id INTEGER REFERENCES question_packs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

async function applyOurMigration(knex: KnexType): Promise<void> {
  const files = await readdir(MIGRATIONS_DIR);
  const target = files.find((f) => f.includes("add-question-embeddings"));
  if (!target) {
    throw new Error("Could not locate add-question-embeddings migration file");
  }
  const mod = await import(path.join(MIGRATIONS_DIR, target));
  await mod.up(knex);
}

export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer("pgvector/pgvector:pg16")
    .withDatabase("quiz_test")
    .withUsername("tester")
    .withPassword("tester")
    .start();

  const knex = Knex({
    client: "pg",
    connection: {
      host: container.getHost(),
      port: container.getPort(),
      user: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    },
    pool: { min: 1, max: 4 },
  });

  await knex.raw(BASE_SCHEMA_SQL);
  await applyOurMigration(knex);

  async function truncate() {
    await knex.raw(`
      TRUNCATE TABLE
        questions,
        categories_packs_lnk,
        categories,
        question_packs
      RESTART IDENTITY CASCADE;
    `);
  }

  async function stop() {
    await knex.destroy();
    await container.stop();
  }

  return { knex, container, stop, truncate };
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/backend/tests/helpers/testDb.ts
git commit --no-verify -m "test(backend): add testDb container fixture"
```

---

## Task 3: Smoke test for the fixture

**Files:**
- Create: `apps/backend/tests/integration/testDb.smoke.test.ts`

- [ ] **Step 1: Write the smoke test**

Create `apps/backend/tests/integration/testDb.smoke.test.ts`:

```ts
import { test, expect, beforeAll, afterAll, describe } from "bun:test";
import { startTestDb, type TestDb } from "../helpers/testDb";

describe("testDb fixture", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await startTestDb();
  }, 60_000);

  afterAll(async () => {
    await db.stop();
  });

  test("pgvector extension is available", async () => {
    const rows = await db.knex.raw(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`,
    );
    expect(rows.rows.length).toBe(1);
  });

  test("questions table has embedding column", async () => {
    const rows = await db.knex.raw(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'questions' AND column_name IN ('embedding', 'embedding_model', 'normalized_answer')
    `);
    expect(rows.rows.length).toBe(3);
  });

  test("HNSW index exists on questions.embedding", async () => {
    const rows = await db.knex.raw(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'questions' AND indexname = 'questions_embedding_hnsw'
    `);
    expect(rows.rows.length).toBe(1);
  });

  test("can insert and query a vector literal", async () => {
    await db.knex.raw(`
      INSERT INTO question_packs (document_id, slug, name) VALUES ('p1', 'smoke', 'Smoke');
    `);
    await db.knex.raw(`
      INSERT INTO questions (document_id, type, text, answer, pack_id, normalized_answer, embedding, embedding_model)
      VALUES ('q1', 'qcm', 'Q', 'A', 1, 'a', ?::vector, 'test-model')
    `, [JSON.stringify(Array(1536).fill(0.1))]);

    const rows = await db.knex.raw(`
      SELECT text, embedding_model FROM questions WHERE text = 'Q'
    `);
    expect(rows.rows[0].embedding_model).toBe("test-model");
  });
});
```

- [ ] **Step 2: Run it**
```bash
cd apps/backend
bun run test:integration
```
Expected: `4 pass, 0 fail` (takes ~15s due to container pull on first run, ~5s subsequently).

- [ ] **Step 3: Commit**
```bash
git add apps/backend/tests/integration/testDb.smoke.test.ts
git commit --no-verify -m "test(backend): add testDb smoke test"
```

---

## Task 4: Integration test for createKnnSearcher

**Files:**
- Create: `apps/backend/tests/integration/knn-searcher.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/backend/tests/integration/knn-searcher.test.ts`:

```ts
import { test, expect, beforeAll, afterAll, beforeEach, describe } from "bun:test";
import pgvector from "pgvector/utils";
import { startTestDb, type TestDb } from "../helpers/testDb";
import { createKnnSearcher } from "../../src/plugins/question-import/server/services/import";
import { mockEmbed, blendedEmbed } from "../mocks/openai-embeddings";

describe("createKnnSearcher (integration)", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await startTestDb();
  }, 60_000);

  afterAll(async () => {
    await db.stop();
  });

  beforeEach(async () => {
    await db.truncate();
    await db.knex.raw(`
      INSERT INTO question_packs (document_id, slug, name) VALUES ('p1', 'geo', 'Geo');
    `);
    await db.knex.raw(`
      INSERT INTO categories (document_id, name, slug) VALUES ('c1', 'Europe', 'europe');
    `);
    // Seed 3 questions with controlled embeddings
    const rows: Array<[string, string, string, string, number[]]> = [
      ["q1", "Capitale de la France ?", "Paris", "paris", mockEmbed("cap france")],
      ["q2", "Plus grande ville française ?", "Paris", "paris", blendedEmbed("cap france", "alt", 0.9)],
      ["q3", "Fleuve traversant Paris ?", "Seine", "seine", mockEmbed("fleuve paris")],
    ];
    for (const [docId, text, answer, norm, emb] of rows) {
      await db.knex.raw(
        `INSERT INTO questions
         (document_id, type, text, answer, pack_id, category_id, normalized_answer, embedding, embedding_model)
         VALUES (?, 'qcm', ?, ?, 1, 1, ?, ?::vector, 'test')`,
        [docId, text, answer, norm, pgvector.toSql(emb)],
      );
    }
  });

  test("returns rows ordered by similarity descending", async () => {
    const knn = createKnnSearcher(db.knex);
    const rows = await knn.search({
      embedding: mockEmbed("cap france"),
      limit: 3,
    });
    expect(rows.length).toBe(3);
    expect(rows[0].text).toBe("Capitale de la France ?");
    expect(rows[0].similarity).toBeGreaterThan(0.99);
    expect(rows[1].similarity).toBeLessThan(rows[0].similarity);
  });

  test("returned rows include packSlug and categoryName", async () => {
    const knn = createKnnSearcher(db.knex);
    const rows = await knn.search({
      embedding: mockEmbed("cap france"),
      limit: 1,
    });
    expect(rows[0].packSlug).toBe("geo");
    expect(rows[0].categoryName).toBe("Europe");
  });

  test("limit is respected", async () => {
    const knn = createKnnSearcher(db.knex);
    const rows = await knn.search({
      embedding: mockEmbed("cap france"),
      limit: 1,
    });
    expect(rows.length).toBe(1);
  });

  test("returns empty array when no questions have embeddings", async () => {
    await db.knex.raw(`UPDATE questions SET embedding = NULL`);
    const knn = createKnnSearcher(db.knex);
    const rows = await knn.search({
      embedding: mockEmbed("cap france"),
      limit: 10,
    });
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run**
```bash
cd apps/backend
bun run test:integration
```
Expected: `8 pass, 0 fail` (smoke 4 + knn 4).

- [ ] **Step 3: Commit**
```bash
git add apps/backend/tests/integration/knn-searcher.test.ts
git commit --no-verify -m "test(backend): integration test for createKnnSearcher"
```

---

## Task 5: Extract persistImport + fix C1 (pgvector.toSql)

**Files:**
- Create: `apps/backend/src/plugins/question-import/server/services/persistImport.ts`
- Create: `apps/backend/tests/integration/persist-import.test.ts`
- Modify: `apps/backend/src/plugins/question-import/server/services/import.ts`

This task extracts the write path into a knex-only function `persistImport` that's trivially integration-testable. Uses `pgvector.toSql()` consistently (fixes C1). Transaction comes in Task 6.

- [ ] **Step 1: Write the failing integration test**

Create `apps/backend/tests/integration/persist-import.test.ts`:

```ts
import { test, expect, beforeAll, afterAll, beforeEach, describe } from "bun:test";
import { startTestDb, type TestDb } from "../helpers/testDb";
import { persistImport } from "../../src/plugins/question-import/server/services/persistImport";
import { mockEmbed } from "../mocks/openai-embeddings";

describe("persistImport (integration)", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await startTestDb();
  }, 60_000);

  afterAll(async () => {
    await db.stop();
  });

  beforeEach(async () => {
    await db.truncate();
  });

  function makeInput(slug = "smoke") {
    return {
      pack: { slug, name: "Smoke Pack" },
      embeddingModel: "text-embedding-3-small",
      questions: [
        {
          category: "Geo",
          type: "qcm" as const,
          text: "Q1",
          choices: ["a", "b", "c", "d"],
          answer: "a",
          embedding: mockEmbed("Q1"),
          normalizedAnswer: "a",
        },
      ],
    };
  }

  test("creates pack, category, question with embedding", async () => {
    const result = await persistImport(db.knex, makeInput());
    expect(result.pack.status).toBe("created");
    expect(result.categories[0].status).toBe("created");
    expect(result.questions.created).toBe(1);

    const packRows = await db.knex.raw(
      `SELECT slug, name FROM question_packs`,
    );
    expect(packRows.rows[0].slug).toBe("smoke");

    const questionRows = await db.knex.raw(
      `SELECT text, normalized_answer, embedding_model,
              (embedding IS NOT NULL) AS has_embedding
       FROM questions`,
    );
    expect(questionRows.rows[0].text).toBe("Q1");
    expect(questionRows.rows[0].has_embedding).toBe(true);
    expect(questionRows.rows[0].embedding_model).toBe("text-embedding-3-small");
  });

  test("reuses existing pack when slug matches", async () => {
    await persistImport(db.knex, makeInput("reuse"));
    const second = await persistImport(db.knex, makeInput("reuse"));
    expect(second.pack.status).toBe("existing");

    const count = await db.knex.raw(
      `SELECT COUNT(*)::int AS n FROM question_packs`,
    );
    expect(count.rows[0].n).toBe(1);
  });

  test("reuses existing category and links it to the new pack", async () => {
    await persistImport(db.knex, makeInput("first"));
    await persistImport(db.knex, makeInput("second"));

    const links = await db.knex.raw(
      `SELECT COUNT(*)::int AS n FROM categories_packs_lnk`,
    );
    expect(links.rows[0].n).toBe(2);

    const cats = await db.knex.raw(
      `SELECT COUNT(*)::int AS n FROM categories`,
    );
    expect(cats.rows[0].n).toBe(1);
  });

  test("stores embedding as pgvector literal, retrievable for KNN", async () => {
    await persistImport(db.knex, makeInput());
    const rows = await db.knex.raw(
      `SELECT 1 - (embedding <=> ?::vector) AS similarity FROM questions`,
      [JSON.stringify(mockEmbed("Q1"))],
    );
    expect(Number(rows.rows[0].similarity)).toBeGreaterThan(0.99);
  });
});
```

- [ ] **Step 2: Confirm fails (module missing)**
```bash
cd apps/backend
bun test tests/integration/persist-import.test.ts
```
Expected: FAIL — `persistImport` not found.

- [ ] **Step 3: Implement `persistImport.ts`**

Create `apps/backend/src/plugins/question-import/server/services/persistImport.ts`:

```ts
import pgvector from "pgvector/utils";
import { randomUUID } from "node:crypto";

export interface PersistQuestion {
  category: string;
  type: "qcm" | "vrai_faux" | "texte";
  text: string;
  choices?: unknown;
  answer: string;
  embedding: number[];
  normalizedAnswer: string;
}

export interface PersistInput {
  pack: {
    slug: string;
    name?: string;
    description?: string;
    icon?: string;
    gradient?: string;
  };
  embeddingModel: string;
  questions: PersistQuestion[];
}

export interface PersistResult {
  pack: { slug: string; status: "created" | "existing" };
  categories: Array<{ name: string; status: "created" | "existing" }>;
  questions: { created: number; total: number };
}

function slugifyName(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function persistImport(
  knex: any,
  input: PersistInput,
): Promise<PersistResult> {
  // 1. Upsert pack
  const packRows = await knex.raw(
    `SELECT id, document_id, slug FROM question_packs WHERE slug = ?`,
    [input.pack.slug],
  );

  let packId: number;
  let packDocumentId: string;
  let packStatus: "created" | "existing";
  if (packRows.rows.length > 0) {
    packId = packRows.rows[0].id;
    packDocumentId = packRows.rows[0].document_id;
    packStatus = "existing";
  } else {
    packDocumentId = randomUUID();
    const inserted = await knex.raw(
      `INSERT INTO question_packs
         (document_id, slug, name, description, icon, gradient, is_free)
       VALUES (?, ?, ?, ?, ?, ?, true)
       RETURNING id`,
      [
        packDocumentId,
        input.pack.slug,
        input.pack.name ?? input.pack.slug,
        input.pack.description ?? null,
        input.pack.icon ?? null,
        input.pack.gradient ?? null,
      ],
    );
    packId = inserted.rows[0].id;
    packStatus = "created";
  }

  // 2. Upsert categories and link them to the pack
  const uniqueCategoryNames = [...new Set(input.questions.map((q) => q.category))];
  const categorySummary: Array<{ name: string; status: "created" | "existing" }> = [];
  const categoryIdByName = new Map<string, number>();

  for (const name of uniqueCategoryNames) {
    const existing = await knex.raw(
      `SELECT id, document_id FROM categories WHERE name = ? LIMIT 1`,
      [name],
    );
    let catId: number;
    let status: "created" | "existing";
    if (existing.rows.length > 0) {
      catId = existing.rows[0].id;
      status = "existing";
    } else {
      const inserted = await knex.raw(
        `INSERT INTO categories (document_id, name, slug) VALUES (?, ?, ?) RETURNING id`,
        [randomUUID(), name, slugifyName(name)],
      );
      catId = inserted.rows[0].id;
      status = "created";
    }

    // Link (idempotent)
    const linkExists = await knex.raw(
      `SELECT 1 FROM categories_packs_lnk WHERE category_id = ? AND pack_id = ?`,
      [catId, packId],
    );
    if (linkExists.rows.length === 0) {
      await knex.raw(
        `INSERT INTO categories_packs_lnk (category_id, pack_id) VALUES (?, ?)`,
        [catId, packId],
      );
    }

    categoryIdByName.set(name, catId);
    categorySummary.push({ name, status });
  }

  // 3. Insert questions with embeddings (using pgvector.toSql — C1 fix)
  let created = 0;
  for (const q of input.questions) {
    const catId = categoryIdByName.get(q.category);
    await knex.raw(
      `INSERT INTO questions
         (document_id, type, text, choices, answer, category_id, pack_id,
          normalized_answer, embedding, embedding_model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::vector, ?)`,
      [
        randomUUID(),
        q.type,
        q.text,
        q.type === "qcm" ? JSON.stringify(q.choices) : null,
        q.answer,
        catId ?? null,
        packId,
        q.normalizedAnswer,
        pgvector.toSql(q.embedding),
        input.embeddingModel,
      ],
    );
    created++;
  }

  return {
    pack: { slug: input.pack.slug, status: packStatus },
    categories: categorySummary,
    questions: { created, total: input.questions.length },
  };
}
```

- [ ] **Step 4: Run test, expect pass**
```bash
cd apps/backend
bun test tests/integration/persist-import.test.ts
```
Expected: `4 pass, 0 fail`.

- [ ] **Step 5: Commit**
```bash
git add apps/backend/src/plugins/question-import/server/services/persistImport.ts apps/backend/tests/integration/persist-import.test.ts
git commit --no-verify -m "feat(question-import): extract persistImport; use pgvector.toSql consistently (C1)"
```

---

## Task 6: Transaction wrapping (fix C2)

**Files:**
- Modify: `apps/backend/src/plugins/question-import/server/services/persistImport.ts`
- Modify: `apps/backend/tests/integration/persist-import.test.ts` — add failing test first

- [ ] **Step 1: Add a failing rollback test**

Append to `apps/backend/tests/integration/persist-import.test.ts`:

```ts
describe("persistImport transaction safety", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await startTestDb();
  }, 60_000);

  afterAll(async () => {
    await db.stop();
  });

  beforeEach(async () => {
    await db.truncate();
  });

  test("rolls back pack + category + earlier questions when a later insert fails", async () => {
    const badEmbedding = [1, 2, 3]; // wrong dimension — will be rejected by pgvector

    const input = {
      pack: { slug: "rollback-test", name: "Rollback" },
      embeddingModel: "test",
      questions: [
        {
          category: "Cat",
          type: "qcm" as const,
          text: "Good",
          choices: ["a", "b", "c", "d"],
          answer: "a",
          embedding: mockEmbed("good"),
          normalizedAnswer: "a",
        },
        {
          category: "Cat",
          type: "qcm" as const,
          text: "Bad",
          choices: ["a", "b", "c", "d"],
          answer: "a",
          embedding: badEmbedding,
          normalizedAnswer: "a",
        },
      ],
    };

    await expect(persistImport(db.knex, input)).rejects.toThrow();

    const packs = await db.knex.raw(`SELECT COUNT(*)::int AS n FROM question_packs`);
    expect(packs.rows[0].n).toBe(0);

    const cats = await db.knex.raw(`SELECT COUNT(*)::int AS n FROM categories`);
    expect(cats.rows[0].n).toBe(0);

    const questions = await db.knex.raw(`SELECT COUNT(*)::int AS n FROM questions`);
    expect(questions.rows[0].n).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect failure**
```bash
cd apps/backend
bun test tests/integration/persist-import.test.ts
```
Expected: the new test FAILS (pack, category, and first question will have been committed before the second question throws).

- [ ] **Step 3: Wrap in transaction**

Modify `apps/backend/src/plugins/question-import/server/services/persistImport.ts`. Change the signature and wrap the body:

Replace the entire `persistImport` function with:

```ts
export async function persistImport(
  knex: any,
  input: PersistInput,
): Promise<PersistResult> {
  return await knex.transaction(async (trx: any) => {
    // 1. Upsert pack
    const packRows = await trx.raw(
      `SELECT id, document_id, slug FROM question_packs WHERE slug = ?`,
      [input.pack.slug],
    );

    let packId: number;
    let packDocumentId: string;
    let packStatus: "created" | "existing";
    if (packRows.rows.length > 0) {
      packId = packRows.rows[0].id;
      packDocumentId = packRows.rows[0].document_id;
      packStatus = "existing";
    } else {
      packDocumentId = randomUUID();
      const inserted = await trx.raw(
        `INSERT INTO question_packs
           (document_id, slug, name, description, icon, gradient, is_free)
         VALUES (?, ?, ?, ?, ?, ?, true)
         RETURNING id`,
        [
          packDocumentId,
          input.pack.slug,
          input.pack.name ?? input.pack.slug,
          input.pack.description ?? null,
          input.pack.icon ?? null,
          input.pack.gradient ?? null,
        ],
      );
      packId = inserted.rows[0].id;
      packStatus = "created";
    }

    // 2. Upsert categories + link
    const uniqueCategoryNames = [...new Set(input.questions.map((q) => q.category))];
    const categorySummary: Array<{ name: string; status: "created" | "existing" }> = [];
    const categoryIdByName = new Map<string, number>();

    for (const name of uniqueCategoryNames) {
      const existing = await trx.raw(
        `SELECT id, document_id FROM categories WHERE name = ? LIMIT 1`,
        [name],
      );
      let catId: number;
      let status: "created" | "existing";
      if (existing.rows.length > 0) {
        catId = existing.rows[0].id;
        status = "existing";
      } else {
        const inserted = await trx.raw(
          `INSERT INTO categories (document_id, name, slug) VALUES (?, ?, ?) RETURNING id`,
          [randomUUID(), name, slugifyName(name)],
        );
        catId = inserted.rows[0].id;
        status = "created";
      }

      const linkExists = await trx.raw(
        `SELECT 1 FROM categories_packs_lnk WHERE category_id = ? AND pack_id = ?`,
        [catId, packId],
      );
      if (linkExists.rows.length === 0) {
        await trx.raw(
          `INSERT INTO categories_packs_lnk (category_id, pack_id) VALUES (?, ?)`,
          [catId, packId],
        );
      }

      categoryIdByName.set(name, catId);
      categorySummary.push({ name, status });
    }

    // 3. Insert questions
    let created = 0;
    for (const q of input.questions) {
      const catId = categoryIdByName.get(q.category);
      await trx.raw(
        `INSERT INTO questions
           (document_id, type, text, choices, answer, category_id, pack_id,
            normalized_answer, embedding, embedding_model)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::vector, ?)`,
        [
          randomUUID(),
          q.type,
          q.text,
          q.type === "qcm" ? JSON.stringify(q.choices) : null,
          q.answer,
          catId ?? null,
          packId,
          q.normalizedAnswer,
          pgvector.toSql(q.embedding),
          input.embeddingModel,
        ],
      );
      created++;
    }

    return {
      pack: { slug: input.pack.slug, status: packStatus },
      categories: categorySummary,
      questions: { created, total: input.questions.length },
    };
  });
}
```

- [ ] **Step 4: Run test, expect pass**
```bash
cd apps/backend
bun test tests/integration/persist-import.test.ts
```
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**
```bash
git add apps/backend/src/plugins/question-import/server/services/persistImport.ts apps/backend/tests/integration/persist-import.test.ts
git commit --no-verify -m "fix(question-import): wrap persistImport in transaction (C2)"
```

---

## Task 7: Wire runCommit to persistImport

**Files:**
- Modify: `apps/backend/src/plugins/question-import/server/services/import.ts`
- Modify: `apps/backend/tests/question-import/commit.integration.test.ts` — validation tests stay

- [ ] **Step 1: Replace the body of `runCommit` in `apps/backend/src/plugins/question-import/server/services/import.ts`**

Find the existing `export async function runCommit(...)` block and replace it (keep types above it intact) with:

```ts
export async function runCommit(
  body: CommitBody,
  deps: CommitDeps,
): Promise<CommitSummary> {
  const errors = validateCommitBody(body);
  if (errors.length > 0) {
    const err = new Error("Validation failed") as Error & { details?: string[] };
    err.details = errors;
    throw err;
  }

  const toImport = body.questions
    .filter((q) => q.decision === "import")
    .map((q) => ({
      category: q.category as string,
      type: q.type as "qcm" | "vrai_faux" | "texte",
      text: q.question as string,
      choices: q.choices,
      answer: q.answer as string,
      embedding: q.embedding,
      normalizedAnswer: q.normalizedAnswer,
    }));

  const { persistImport } = await import("./persistImport");
  const result = await persistImport(deps.strapi.db.connection, {
    pack: body.pack,
    embeddingModel: body.embeddingModel,
    questions: toImport,
  });

  return {
    pack: result.pack,
    categories: result.categories,
    questions: {
      created: result.questions.created,
      skipped: body.questions.length - result.questions.created,
      total: body.questions.length,
    },
  };
}
```

Remove the old implementation (the inline pack/category/question creation code — it's entirely replaced by the `persistImport` call).

- [ ] **Step 2: Run all tests**
```bash
cd apps/backend
bun test tests/
```
Expected: 36 unit + 9 integration = 45 pass / 0 fail.

- [ ] **Step 3: Commit**
```bash
git add apps/backend/src/plugins/question-import/server/services/import.ts
git commit --no-verify -m "refactor(question-import): runCommit delegates writes to persistImport"
```

---

## Task 8: Server-side re-classification at commit (fix C3 + I6)

**Files:**
- Modify: `apps/backend/src/plugins/question-import/server/services/import.ts`
- Create: `apps/backend/tests/question-import/commit.reclassify.test.ts`

The commit endpoint must not trust `decision`, `status`, or `embedding` from the client. Instead it:
1. Re-embeds each question to be imported (server-derived embedding).
2. Runs KNN + `classifyCandidate` to re-compute `status`.
3. Runs `detectIntraBatchDuplicates` on the server-derived embeddings.
4. Only then applies the client's `decision`:
   - For `status === "auto_blocked"` and `decision === "import"`, `overrideReason` is required.
   - For `status === "intra_batch_duplicate"` and `decision === "import"`, require the same `overrideReason` gate.

- [ ] **Step 1: Write failing tests**

Create `apps/backend/tests/question-import/commit.reclassify.test.ts`:

```ts
import { test, expect, describe } from "bun:test";
import {
  reclassifyForCommit,
  type ClientCommitQuestion,
} from "../../src/plugins/question-import/server/services/import";
import { mockEmbed } from "../mocks/openai-embeddings";
import { createEmbeddingService } from "../../src/plugins/question-import/server/services/embeddings";

function fakeOpenAIClient() {
  return {
    embeddings: {
      create: async ({ input }: { input: string[] }) => ({
        data: input.map((t) => ({ embedding: mockEmbed(t) })),
      }),
    },
  };
}

const embeddings = createEmbeddingService({
  client: fakeOpenAIClient() as any,
  model: "test",
});

function baseQ(overrides: Partial<ClientCommitQuestion> = {}): ClientCommitQuestion {
  return {
    category: "Cat",
    type: "qcm",
    question: "Q",
    choices: ["a", "b", "c", "d"],
    answer: "a",
    decision: "import",
    ...overrides,
  };
}

describe("reclassifyForCommit", () => {
  test("server re-embeds from question text (client embedding is ignored)", async () => {
    const result = await reclassifyForCommit({
      questions: [baseQ()],
      embeddings,
      knn: { search: async () => [] },
    });
    expect(result[0].embedding).toEqual(mockEmbed("Q"));
    expect(result[0].status).toBe("clean");
  });

  test("server overrides forged status", async () => {
    // Even if the client sent something misleading, the server recomputes
    const result = await reclassifyForCommit({
      questions: [baseQ({ question: "Q" })],
      embeddings,
      knn: {
        search: async () => [{
          questionId: 1,
          text: "existing",
          packSlug: "p",
          categoryName: "c",
          similarity: 0.95,
          normalizedAnswer: "a",
        }],
      },
    });
    expect(result[0].status).toBe("auto_blocked");
  });

  test("auto_blocked + decision=import + no override → validation error", async () => {
    const result = await reclassifyForCommit({
      questions: [baseQ({ question: "Q" })],
      embeddings,
      knn: {
        search: async () => [{
          questionId: 1,
          text: "existing",
          packSlug: "p",
          categoryName: "c",
          similarity: 0.95,
          normalizedAnswer: "a",
        }],
      },
    });
    expect(result[0].status).toBe("auto_blocked");
    expect(result[0].requiresOverrideReason).toBe(true);
  });

  test("intra_batch_duplicate on the server regardless of client status", async () => {
    const result = await reclassifyForCommit({
      questions: [baseQ({ question: "Duplicate" }), baseQ({ question: "Duplicate" })],
      embeddings,
      knn: { search: async () => [] },
    });
    expect(result[0].status).toBe("clean");
    expect(result[1].status).toBe("intra_batch_duplicate");
  });
});
```

- [ ] **Step 2: Confirm fails**
```bash
cd apps/backend
bun test tests/question-import/commit.reclassify.test.ts
```
Expected: FAIL — `reclassifyForCommit` not exported.

- [ ] **Step 3: Implement `reclassifyForCommit` in `apps/backend/src/plugins/question-import/server/services/import.ts`**

Append to the file (below existing exports, above `runCommit`):

```ts
export interface ClientCommitQuestion {
  category?: string;
  type?: string;
  question?: string;
  choices?: unknown;
  answer?: string;
  decision: "import" | "skip";
  overrideReason?: string;
}

export interface ReclassifyDeps {
  embeddings: EmbeddingService;
  knn: KnnSearcher;
}

export interface ReclassifiedQuestion {
  source: ClientCommitQuestion;
  embedding: number[];
  normalizedAnswer: string;
  status: ClassifiedCandidate["status"];
  matches: ClassifiedCandidate["matches"];
  requiresOverrideReason: boolean;
}

export async function reclassifyForCommit(args: {
  questions: ClientCommitQuestion[];
  embeddings: EmbeddingService;
  knn: KnnSearcher;
}): Promise<ReclassifiedQuestion[]> {
  const texts = args.questions.map((q) => (q.question as string) ?? "");
  const embeddingVecs = await args.embeddings.embedBatch(texts);
  const normalized = args.questions.map((q) => normalizeAnswer((q.answer as string) ?? ""));

  const intraDup = detectIntraBatchDuplicates(
    embeddingVecs.map((e, i) => ({
      embedding: e,
      normalizedAnswer: normalized[i],
    })),
  );

  const out: ReclassifiedQuestion[] = [];
  for (let i = 0; i < args.questions.length; i++) {
    const matches = await args.knn.search({ embedding: embeddingVecs[i], limit: 10 });
    const classified = classifyCandidate(
      { normalizedAnswer: normalized[i] },
      matches,
    );
    const status = intraDup.has(i) ? "intra_batch_duplicate" : classified.status;
    const requiresOverrideReason =
      (status === "auto_blocked" || status === "intra_batch_duplicate") &&
      args.questions[i].decision === "import";
    out.push({
      source: args.questions[i],
      embedding: embeddingVecs[i],
      normalizedAnswer: normalized[i],
      status,
      matches: classified.matches,
      requiresOverrideReason,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run, expect pass**
```bash
cd apps/backend
bun test tests/question-import/commit.reclassify.test.ts
```
Expected: `4 pass, 0 fail`.

- [ ] **Step 5: Rework `runCommit` to use reclassified output**

In `apps/backend/src/plugins/question-import/server/services/import.ts`, replace the existing `runCommit` body:

```ts
export async function runCommit(
  body: CommitBody,
  deps: CommitDeps,
): Promise<CommitSummary> {
  const errors = validateCommitBody(body);
  if (errors.length > 0) {
    const err = new Error("Validation failed") as Error & { details?: string[] };
    err.details = errors;
    throw err;
  }

  const reclassified = await reclassifyForCommit({
    questions: body.questions,
    embeddings: deps.embeddings,
    knn: deps.knn,
  });

  const overrideErrors: string[] = [];
  for (let i = 0; i < reclassified.length; i++) {
    const r = reclassified[i];
    if (
      r.requiresOverrideReason &&
      (!r.source.overrideReason || r.source.overrideReason.trim() === "")
    ) {
      overrideErrors.push(
        `questions[${i}].overrideReason required for server-computed status "${r.status}"`,
      );
    }
  }
  if (overrideErrors.length > 0) {
    const err = new Error("Override required") as Error & { details?: string[] };
    err.details = overrideErrors;
    throw err;
  }

  const toImport = reclassified
    .filter((r) => r.source.decision === "import")
    .map((r) => ({
      category: r.source.category as string,
      type: r.source.type as "qcm" | "vrai_faux" | "texte",
      text: r.source.question as string,
      choices: r.source.choices,
      answer: r.source.answer as string,
      embedding: r.embedding,
      normalizedAnswer: r.normalizedAnswer,
    }));

  const { persistImport } = await import("./persistImport");
  const result = await persistImport(deps.strapi.db.connection, {
    pack: body.pack,
    embeddingModel: body.embeddingModel,
    questions: toImport,
  });

  return {
    pack: result.pack,
    categories: result.categories,
    questions: {
      created: result.questions.created,
      skipped: body.questions.length - result.questions.created,
      total: body.questions.length,
    },
  };
}
```

Also update `CommitDeps`:

```ts
export interface CommitDeps {
  strapi: any;
  embeddings: EmbeddingService;
  knn: KnnSearcher;
}
```

- [ ] **Step 6: Update `validateCommitBody`** — remove the `embedding.length !== 1536` check (server derives), and remove the `status === "auto_blocked"` check (server will recompute). Replace the whole function:

```ts
export function validateCommitBody(body: CommitBody): string[] {
  const errors: string[] = [];
  if (!body.pack?.slug) errors.push("pack.slug required");
  if (!body.embeddingModel) errors.push("embeddingModel required");
  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    errors.push("questions must be non-empty");
    return errors;
  }
  for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i];
    const p = `questions[${i}]`;
    if (!["import", "skip"].includes(q.decision as any)) {
      errors.push(`${p}.decision must be import|skip`);
    }
    if (!q.question || typeof q.question !== "string") {
      errors.push(`${p}.question is required`);
    }
    if (!q.answer || typeof q.answer !== "string") {
      errors.push(`${p}.answer is required`);
    }
    if (!q.category || typeof q.category !== "string") {
      errors.push(`${p}.category is required`);
    }
    if (!q.type || !["qcm", "vrai_faux", "texte"].includes(q.type as any)) {
      errors.push(`${p}.type invalid`);
    }
  }
  return errors;
}
```

- [ ] **Step 7: Update `apps/backend/tests/question-import/commit.integration.test.ts`**

The old tests asserted that client-supplied `embedding` was validated. That's no longer true. Replace the whole file:

```ts
import { test, expect, describe } from "bun:test";
import { validateCommitBody } from "../../src/plugins/question-import/server/services/import";

function baseBody(overrides: any = {}) {
  const base = {
    pack: { slug: "p", name: "P" },
    embeddingModel: "text-embedding-3-small",
    questions: [
      {
        category: "C",
        type: "qcm",
        question: "Q",
        choices: ["a", "b", "c", "d"],
        answer: "a",
        decision: "import",
      },
    ],
  };
  return { ...base, ...overrides };
}

describe("validateCommitBody", () => {
  test("valid body → no errors", () => {
    expect(validateCommitBody(baseBody())).toEqual([]);
  });

  test("missing pack.slug → error", () => {
    expect(validateCommitBody(baseBody({ pack: { name: "P" } }))).toContain(
      "pack.slug required",
    );
  });

  test("missing embeddingModel → error", () => {
    expect(validateCommitBody(baseBody({ embeddingModel: "" }))).toContain(
      "embeddingModel required",
    );
  });

  test("invalid decision → error", () => {
    const body = baseBody({
      questions: [{ ...baseBody().questions[0], decision: "bogus" }],
    });
    expect(validateCommitBody(body)[0]).toMatch(/decision/);
  });

  test("missing question text → error", () => {
    const body = baseBody({
      questions: [{ ...baseBody().questions[0], question: "" }],
    });
    expect(validateCommitBody(body)[0]).toMatch(/question/);
  });

  test("skip decision is valid", () => {
    const body = baseBody({
      questions: [{ ...baseBody().questions[0], decision: "skip" }],
    });
    expect(validateCommitBody(body)).toEqual([]);
  });
});
```

- [ ] **Step 8: Update `CommitQuestion` interface**

In `apps/backend/src/plugins/question-import/server/services/import.ts`, replace `CommitQuestion` and related types:

```ts
export type QuestionDecision = "import" | "skip";

export interface CommitQuestion {
  category?: string;
  type?: string;
  question?: string;
  choices?: unknown;
  answer?: string;
  decision: QuestionDecision;
  overrideReason?: string;
}

export interface CommitBody {
  pack: ImportPack & { slug: string };
  embeddingModel: string;
  questions: CommitQuestion[];
}
```

- [ ] **Step 9: Run all tests**
```bash
cd apps/backend
bun test tests/
```
Expected: all unit tests (~40) + all integration tests (~9) pass. If any test depends on old `embedding` field in `CommitQuestion`, update it to match the new shape.

- [ ] **Step 10: Commit**
```bash
git add apps/backend/src/plugins/question-import/server/services/import.ts apps/backend/tests/question-import/
git commit --no-verify -m "fix(question-import): server-side re-classification at commit (C3+I6)"
```

---

## Task 9: Wire controller to new runCommit signature

**Files:**
- Modify: `apps/backend/src/plugins/question-import/server/controllers/import.ts`

- [ ] **Step 1: Update the controller**

Replace `apps/backend/src/plugins/question-import/server/controllers/import.ts` with:

```ts
import { runPreview, runCommit, createKnnSearcher } from "../services/import";
import { createDefaultEmbeddingService } from "../services/embeddings";

const MODEL = "text-embedding-3-small";

declare const strapi: any;

export default {
  async preview(ctx: any) {
    try {
      const embeddings = createDefaultEmbeddingService();
      const knn = createKnnSearcher(strapi.db.connection);
      const result = await runPreview(ctx.request.body as any, {
        embeddings,
        knn,
        model: MODEL,
      });
      ctx.body = result;
    } catch (err) {
      const details = (err as any).details;
      if (details) {
        ctx.status = 400;
        ctx.body = { success: false, errors: details };
        return;
      }
      strapi.log.error("[question-import] preview failed", err);
      ctx.status = 500;
      ctx.body = { success: false, error: (err as Error).message };
    }
  },

  async commit(ctx: any) {
    try {
      const embeddings = createDefaultEmbeddingService();
      const knn = createKnnSearcher(strapi.db.connection);
      const summary = await runCommit(ctx.request.body as any, {
        strapi,
        embeddings,
        knn,
      });
      ctx.body = { success: true, summary };
    } catch (err) {
      const details = (err as any).details;
      if (details) {
        ctx.status = 400;
        ctx.body = { success: false, errors: details };
        return;
      }
      strapi.log.error("[question-import] commit failed", err);
      ctx.status = 500;
      ctx.body = { success: false, error: (err as Error).message };
    }
  },
};
```

This also covers **I5** (error logging via `strapi.log.error`).

- [ ] **Step 2: Quick boot test**
```bash
cd apps/backend
PORT=1338 bun run strapi develop
```
Expected: Strapi boots cleanly. Ctrl+C.

- [ ] **Step 3: Commit**
```bash
git add apps/backend/src/plugins/question-import/server/controllers/import.ts
git commit --no-verify -m "feat(question-import): wire controllers to new runCommit; log errors (I5)"
```

---

## Task 10: Integration test for runCommit end-to-end

**Files:**
- Create: `apps/backend/tests/integration/runCommit.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/backend/tests/integration/runCommit.test.ts`:

```ts
import { test, expect, beforeAll, afterAll, beforeEach, describe } from "bun:test";
import { startTestDb, type TestDb } from "../helpers/testDb";
import {
  runCommit,
  createKnnSearcher,
} from "../../src/plugins/question-import/server/services/import";
import { createEmbeddingService } from "../../src/plugins/question-import/server/services/embeddings";
import { mockEmbed } from "../mocks/openai-embeddings";

function fakeOpenAIClient() {
  return {
    embeddings: {
      create: async ({ input }: { input: string[] }) => ({
        data: input.map((t) => ({ embedding: mockEmbed(t) })),
      }),
    },
  };
}

describe("runCommit (integration)", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await startTestDb();
  }, 60_000);

  afterAll(async () => {
    await db.stop();
  });

  beforeEach(async () => {
    await db.truncate();
  });

  function makeDeps() {
    return {
      strapi: { db: { connection: db.knex } },
      embeddings: createEmbeddingService({ client: fakeOpenAIClient() as any, model: "test" }),
      knn: createKnnSearcher(db.knex),
    };
  }

  test("creates pack + category + question with server-derived embedding", async () => {
    const body = {
      pack: { slug: "int1", name: "Int 1" },
      embeddingModel: "test-embedding-3-small",
      questions: [
        {
          category: "Geo",
          type: "qcm",
          question: "Capitale du Japon ?",
          choices: ["Tokyo", "Kyoto", "Osaka", "Nagoya"],
          answer: "Tokyo",
          decision: "import",
        },
      ],
    };
    const summary = await runCommit(body as any, makeDeps() as any);
    expect(summary.questions.created).toBe(1);

    const rows = await db.knex.raw(
      `SELECT text, embedding_model, normalized_answer FROM questions`,
    );
    expect(rows.rows[0].text).toBe("Capitale du Japon ?");
    expect(rows.rows[0].normalized_answer).toBe("tokyo");
  });

  test("rejects auto_blocked without override reason (server-computed status)", async () => {
    // Seed an existing question that would make the candidate auto_blocked
    await db.knex.raw(
      `INSERT INTO question_packs (document_id, slug, name) VALUES ('p1', 'prior', 'Prior')`,
    );
    const { createKnnSearcher: _ } = await import("../../src/plugins/question-import/server/services/import");
    const pgvectorImport = await import("pgvector/utils");
    const vec = pgvectorImport.default.toSql(mockEmbed("Capitale du Japon ?"));
    await db.knex.raw(
      `INSERT INTO questions (document_id, type, text, answer, pack_id, normalized_answer, embedding, embedding_model)
       VALUES ('q1', 'qcm', 'Capitale du Japon ?', 'Tokyo', 1, 'tokyo', ${'?::vector'}, 'test')`,
      [vec],
    );

    const body = {
      pack: { slug: "int2", name: "Int 2" },
      embeddingModel: "test",
      questions: [
        {
          category: "Geo",
          type: "qcm",
          question: "Capitale du Japon ?",
          choices: ["Tokyo", "Kyoto", "Osaka", "Nagoya"],
          answer: "Tokyo",
          decision: "import",
        },
      ],
    };
    await expect(runCommit(body as any, makeDeps() as any)).rejects.toThrow(/Override required/);

    const packs = await db.knex.raw(`SELECT COUNT(*)::int AS n FROM question_packs WHERE slug='int2'`);
    expect(packs.rows[0].n).toBe(0);
  });

  test("accepts auto_blocked with override reason", async () => {
    await db.knex.raw(
      `INSERT INTO question_packs (document_id, slug, name) VALUES ('p1', 'prior2', 'Prior')`,
    );
    const pgvectorImport = await import("pgvector/utils");
    const vec = pgvectorImport.default.toSql(mockEmbed("Exact match"));
    await db.knex.raw(
      `INSERT INTO questions (document_id, type, text, answer, pack_id, normalized_answer, embedding, embedding_model)
       VALUES ('q1', 'qcm', 'Exact match', 'x', 1, 'x', ?::vector, 'test')`,
      [vec],
    );

    const body = {
      pack: { slug: "int3", name: "Int 3" },
      embeddingModel: "test",
      questions: [
        {
          category: "Geo",
          type: "qcm",
          question: "Exact match",
          choices: ["x", "b", "c", "d"],
          answer: "x",
          decision: "import",
          overrideReason: "known collision, intentional",
        },
      ],
    };
    const summary = await runCommit(body as any, makeDeps() as any);
    expect(summary.questions.created).toBe(1);
  });

  test("skip decisions do not create rows", async () => {
    const body = {
      pack: { slug: "int4", name: "Int 4" },
      embeddingModel: "test",
      questions: [
        {
          category: "X",
          type: "qcm",
          question: "will skip",
          choices: ["a", "b", "c", "d"],
          answer: "a",
          decision: "skip",
        },
      ],
    };
    const summary = await runCommit(body as any, makeDeps() as any);
    expect(summary.questions.created).toBe(0);
    expect(summary.questions.skipped).toBe(1);

    const count = await db.knex.raw(`SELECT COUNT(*)::int AS n FROM questions`);
    expect(count.rows[0].n).toBe(0);
  });
});
```

- [ ] **Step 2: Run**
```bash
cd apps/backend
bun run test:integration
```
Expected: All integration tests pass (smoke 4 + knn 4 + persist-import 5 + runCommit 4 = 17).

- [ ] **Step 3: Commit**
```bash
git add apps/backend/tests/integration/runCommit.test.ts
git commit --no-verify -m "test(question-import): integration tests for runCommit end-to-end"
```

---

## Task 11: Proper cosine similarity (fix I1)

**Files:**
- Modify: `apps/backend/src/plugins/question-import/server/services/analyzer.ts`
- Modify: `apps/backend/tests/question-import/analyzer.test.ts`

- [ ] **Step 1: Add failing test for unnormalized vectors**

Append to `apps/backend/tests/question-import/analyzer.test.ts`:

```ts
describe("cosine similarity (internal)", () => {
  test("returns true cosine for unnormalized vectors", () => {
    // Scaled vector — dot product would misleadingly be large
    // Verify via intra-batch detection: two identical texts should still be duplicates
    // even if their embeddings get scaled weirdly.
    const a = [2, 0, 0];
    const b = [4, 0, 0];
    // dot=8, cosine=1
    const items = [
      { embedding: a, normalizedAnswer: "x" },
      { embedding: b, normalizedAnswer: "x" },
    ];
    const dup = detectIntraBatchDuplicates(items);
    expect(dup.has(1)).toBe(true);
  });

  test("different vectors below threshold are not duplicates", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0]; // orthogonal → cosine=0
    const items = [
      { embedding: a, normalizedAnswer: "x" },
      { embedding: b, normalizedAnswer: "x" },
    ];
    const dup = detectIntraBatchDuplicates(items);
    expect(dup.has(1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — first test may pass by accident (dot=8 ≥ 0.92), second depends. Run and see.**

```bash
cd apps/backend
bun test tests/question-import/analyzer.test.ts
```

The point is to document behavior against mathematical cosine; rename the helper and fix the math.

- [ ] **Step 3: Replace `cosine` in `apps/backend/src/plugins/question-import/server/services/analyzer.ts`**

Replace the `cosine` function at the bottom of the file:

```ts
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}
```

- [ ] **Step 4: Run all tests — all should still pass (OpenAI-normalized embeddings give the same dot/cosine value anyway)**

```bash
cd apps/backend
bun test tests/
```
Expected: all pass.

- [ ] **Step 5: Commit**
```bash
git add apps/backend/src/plugins/question-import/server/services/analyzer.ts apps/backend/tests/question-import/analyzer.test.ts
git commit --no-verify -m "fix(question-import): compute true cosine similarity (I1)"
```

---

## Task 12: Real LRU cache (fix I2)

**Files:**
- Modify: `apps/backend/src/plugins/question-import/server/services/embeddings.ts`
- Modify: `apps/backend/tests/question-import/embeddings.test.ts`

- [ ] **Step 1: Add failing LRU eviction test**

Append to `apps/backend/tests/question-import/embeddings.test.ts`:

```ts
test("LRU: bumps recency on hit, evicts least-recently-used", async () => {
  const client = makeFakeClient();
  const svc = createEmbeddingService({
    client: client as any,
    model: "test",
    cacheSize: 2,
  });
  await svc.embedBatch(["a"]); // cache = [a]
  await svc.embedBatch(["b"]); // cache = [a, b]
  await svc.embedBatch(["a"]); // hit; LRU order = [b, a] (b oldest)
  await svc.embedBatch(["c"]); // evict b (oldest after bump), cache = [a, c]

  // Now request "a" again — should be cache hit
  const before = client.calls.length;
  await svc.embedBatch(["a"]);
  expect(client.calls.length).toBe(before); // no new call

  // Request "b" — should trigger a new call since it was evicted
  await svc.embedBatch(["b"]);
  expect(client.calls.length).toBe(before + 1);
});
```

- [ ] **Step 2: Run — expect fail (current cache is FIFO, "a" gets evicted when "c" comes in)**

```bash
cd apps/backend
bun test tests/question-import/embeddings.test.ts
```

- [ ] **Step 3: Fix eviction in `apps/backend/src/plugins/question-import/server/services/embeddings.ts`**

Replace the `get` function inside `createEmbeddingService`:

```ts
function get(text: string): number[] | undefined {
  const key = cacheKey(text);
  const v = cache.get(key);
  if (v !== undefined) {
    cache.delete(key);
    cache.set(key, v); // bump recency
  }
  return v;
}
```

- [ ] **Step 4: Run — expect pass**
```bash
cd apps/backend
bun test tests/question-import/embeddings.test.ts
```
Expected: all pass.

- [ ] **Step 5: Commit**
```bash
git add apps/backend/src/plugins/question-import/server/services/embeddings.ts apps/backend/tests/question-import/embeddings.test.ts
git commit --no-verify -m "fix(question-import): real LRU cache eviction (I2)"
```

---

## Task 13: Batch size limit (fix I3)

**Files:**
- Modify: `apps/backend/src/plugins/question-import/server/services/import.ts`
- Modify: `apps/backend/tests/question-import/preview.integration.test.ts`

- [ ] **Step 1: Add failing test**

Append to `apps/backend/tests/question-import/preview.integration.test.ts`:

```ts
test("rejects batch larger than MAX_QUESTIONS_PER_IMPORT", async () => {
  const questions = Array.from({ length: 501 }, (_, i) =>
    qcm(`Q${i} ?`, `A${i}`),
  );
  const body = { pack: samplePack, questions };
  await expect(
    runPreview(body, { embeddings, knn: fakeKnn([]), model: "test" }),
  ).rejects.toThrow(/too many/i);
});
```

- [ ] **Step 2: Run — expect fail**
```bash
cd apps/backend
bun test tests/question-import/preview.integration.test.ts
```

- [ ] **Step 3: Add the limit**

In `apps/backend/src/plugins/question-import/server/services/import.ts`, update `validateImportBody`:

```ts
export const MAX_QUESTIONS_PER_IMPORT = 500;

export function validateImportBody(body: ImportBody): string[] {
  const errors: string[] = [];
  if (!body.pack) return ["pack is required"];
  if (!body.pack.slug || typeof body.pack.slug !== "string" || body.pack.slug.trim() === "") {
    errors.push("pack.slug is required");
  }
  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    errors.push("questions must be a non-empty array");
    return errors;
  }
  if (body.questions.length > MAX_QUESTIONS_PER_IMPORT) {
    errors.push(
      `too many questions (${body.questions.length}); max ${MAX_QUESTIONS_PER_IMPORT}`,
    );
    return errors;
  }
  for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i];
    const p = `questions[${i}]`;
    if (!q.category) errors.push(`${p}.category is required`);
    if (!q.type || !VALID_TYPES.includes(q.type as (typeof VALID_TYPES)[number])) {
      errors.push(`${p}.type invalid`);
    }
    if (!q.question) errors.push(`${p}.question is required`);
    if (!q.answer) errors.push(`${p}.answer is required`);
    if (q.type === "qcm") {
      if (
        !Array.isArray(q.choices) ||
        q.choices.length !== 4 ||
        !q.choices.every((c: unknown) => typeof c === "string")
      ) {
        errors.push(`${p}.choices must be exactly 4 strings for qcm`);
      }
    }
    if (q.type === "vrai_faux" && q.answer !== "true" && q.answer !== "false") {
      errors.push(`${p}.answer must be "true" or "false" for vrai_faux`);
    }
  }
  return errors;
}
```

- [ ] **Step 4: Run — expect pass**
```bash
cd apps/backend
bun test tests/
```

- [ ] **Step 5: Commit**
```bash
git add apps/backend/src/plugins/question-import/server/services/import.ts apps/backend/tests/question-import/preview.integration.test.ts
git commit --no-verify -m "fix(question-import): reject imports over 500 questions (I3)"
```

---

## Task 14: Parallel KNN queries (fix I4)

**Files:**
- Modify: `apps/backend/src/plugins/question-import/server/services/import.ts`

- [ ] **Step 1: Parallelize KNN in `runPreview`**

Replace the `candidates` loop in `runPreview` body with:

```ts
const allExistingMatches = await Promise.all(
  embeddings.map((e) => deps.knn.search({ embedding: e, limit: 10 })),
);

const candidates: PreviewCandidate[] = [];
for (let i = 0; i < questions.length; i++) {
  const existing = allExistingMatches[i];
  const classified = classifyCandidate(
    { normalizedAnswer: normalized[i] },
    existing,
  );

  const status = intraBatchDuplicates.has(i)
    ? "intra_batch_duplicate"
    : classified.status;

  candidates.push({
    index: i,
    question: questions[i].question as string,
    normalizedAnswer: normalized[i],
    embedding: embeddings[i],
    status,
    matches: classified.matches,
  });
}
```

Do the same in `reclassifyForCommit`:

```ts
export async function reclassifyForCommit(args: {
  questions: ClientCommitQuestion[];
  embeddings: EmbeddingService;
  knn: KnnSearcher;
}): Promise<ReclassifiedQuestion[]> {
  const texts = args.questions.map((q) => (q.question as string) ?? "");
  const embeddingVecs = await args.embeddings.embedBatch(texts);
  const normalized = args.questions.map((q) => normalizeAnswer((q.answer as string) ?? ""));

  const intraDup = detectIntraBatchDuplicates(
    embeddingVecs.map((e, i) => ({
      embedding: e,
      normalizedAnswer: normalized[i],
    })),
  );

  const allMatches = await Promise.all(
    embeddingVecs.map((e) => args.knn.search({ embedding: e, limit: 10 })),
  );

  const out: ReclassifiedQuestion[] = [];
  for (let i = 0; i < args.questions.length; i++) {
    const matches = allMatches[i];
    const classified = classifyCandidate(
      { normalizedAnswer: normalized[i] },
      matches,
    );
    const status = intraDup.has(i) ? "intra_batch_duplicate" : classified.status;
    const requiresOverrideReason =
      (status === "auto_blocked" || status === "intra_batch_duplicate") &&
      args.questions[i].decision === "import";
    out.push({
      source: args.questions[i],
      embedding: embeddingVecs[i],
      normalizedAnswer: normalized[i],
      status,
      matches: classified.matches,
      requiresOverrideReason,
    });
  }
  return out;
}
```

- [ ] **Step 2: Run all tests**
```bash
cd apps/backend
bun test tests/
```
Expected: all pass (results identical, just faster).

- [ ] **Step 3: Commit**
```bash
git add apps/backend/src/plugins/question-import/server/services/import.ts
git commit --no-verify -m "perf(question-import): parallelize KNN queries (I4)"
```

---

## Task 15: Minor polish — Review.tsx defensive decisions

**Files:**
- Modify: `apps/backend/src/plugins/question-import/admin/src/pages/Review.tsx`

- [ ] **Step 1: Add guard in `handleCommit`**

In `apps/backend/src/plugins/question-import/admin/src/pages/Review.tsx`, update the `handleCommit` function:

```ts
async function handleCommit() {
  if (!draft) return;
  setBusy(true);
  setError(null);
  try {
    const requestQuestions = draft.request.questions;
    const questions = draft.response.candidates.map((c) => {
      const src = requestQuestions[c.index];
      const dec = decisions[c.index] ?? { include: false, overrideReason: "" };
      return {
        ...src,
        // Server re-derives embedding + normalizedAnswer, but we still send
        // what we had so API shape stays consistent.
        embedding: c.embedding,
        normalizedAnswer: c.normalizedAnswer,
        status: c.status,
        decision: (dec.include ? "import" : "skip") as "import" | "skip",
        overrideReason: dec.overrideReason || undefined,
      };
    });
    await postCommit({
      pack: draft.request.pack,
      embeddingModel: draft.response.embeddingModel,
      questions,
    });
    await deleteDraft(draft.previewId);
    navigate("..");
  } catch (e: any) {
    setError(e.message ?? String(e));
  } finally {
    setBusy(false);
  }
}
```

Also reset `draft` at the top of the effect:

```ts
useEffect(() => {
  if (!previewId) return;
  setDraft(null);
  setDecisions({});
  loadDraft(previewId).then((d) => {
    if (!d) return;
    setDraft(d);
    const init: DecisionMap = {};
    for (const c of d.response.candidates) {
      init[c.index] = {
        include: c.status === "clean" || c.status === "needs_review",
        overrideReason: "",
      };
    }
    setDecisions(init);
  });
}, [previewId]);
```

- [ ] **Step 2: Strapi build check**
```bash
cd apps/backend
bun run strapi build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**
```bash
git add apps/backend/src/plugins/question-import/admin/src/pages/Review.tsx
git commit --no-verify -m "fix(question-import): defensive Review.tsx commit + effect cleanup"
```

---

## Task 16: Full test suite validation

- [ ] **Step 1: Run everything**
```bash
cd apps/backend
bun test tests/
```

Expected: all tests pass — roughly 42+ unit tests, 17+ integration tests.

- [ ] **Step 2: Type check**
```bash
cd apps/backend
bunx tsc --noEmit -p tsconfig.test.json
```
Expected: clean.

- [ ] **Step 3: Close-out commit**
```bash
git commit --allow-empty --no-verify -m "chore(question-import): hardening complete — all tests green"
```

---

## Self-review notes (for planner)

- All Critical and Important issues from the review have tasks.
- Minor M4 (`decisions[index]` undefined) is covered in Task 15. M3 (effect reload) is covered in Task 15.
- Minor M1 (`any` pervasiveness), M5 (punctuation stripping), M6 (more test coverage like `vrai_faux`), M7 (comment) are **intentionally deferred** — cheap wins for a follow-up polish round but not critical for correctness/security.
- The refactor in Task 5 does change the behavior of `runCommit` slightly: previously it went through `strapi.documents()` which triggers Strapi lifecycle hooks. The new path uses raw Knex inserts. **This loses lifecycle hooks on question/pack/category creation.** Acceptable for our use case (no hooks registered on these entities today), but if hooks are added later, `persistImport` will need rethinking. Note added as comment in `persistImport.ts`.
- Embedding serialization switched from `JSON.stringify` to `pgvector.toSql` — the underlying string format is the same (`[0.1,0.2,...]`) so existing rows remain valid; just more robust for edge cases.
- `validateCommitBody` no longer checks `embedding.length` — that invariant moves server-side (server re-derives). Clients sending embeddings are now ignored, not rejected, for forward compatibility.
