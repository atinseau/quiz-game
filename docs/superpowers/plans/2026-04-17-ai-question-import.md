# AI Question Import & Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Strapi admin plugin that imports batches of questions via JSON, detects semantic duplicates via OpenAI embeddings + pgvector, and offers an admin review UI for ambiguous cases.

**Architecture:** New Strapi plugin `question-import` living in `apps/backend/src/plugins/question-import/`. Server side exposes `/preview` (stateless analysis) and `/commit` (write) routes. Admin side provides Upload + Review pages with IndexedDB-persisted drafts. Embeddings via OpenAI `text-embedding-3-small`, stored on the existing `questions` table as a `vector(1536)` column with an HNSW index. Postgres runs locally via `docker compose` with the `pgvector/pgvector:pg16` image.

**Tech Stack:** Strapi 5, Postgres 16 + pgvector, Knex (Strapi's query builder), TypeScript, React (admin), OpenAI SDK, `pgvector` npm package for (de)serialization, `idb-keyval` for IndexedDB, Bun as runtime.

**Reference spec:** `docs/superpowers/specs/2026-04-17-ai-question-import-design.md`

---

## File Structure

### Created

- `docker-compose.yml` — Postgres + pgvector (already created, validate in Task 1)
- `scripts/pg-init/01-enable-pgvector.sql` — init SQL (already created, validate in Task 1)
- `apps/backend/database/migrations/2026-04-17T000000-add-question-embeddings.js` — schema migration
- `apps/backend/src/plugins/question-import/package.json` — plugin manifest
- `apps/backend/src/plugins/question-import/strapi-server.ts` — server bootstrap
- `apps/backend/src/plugins/question-import/strapi-admin.ts` — admin bootstrap
- `apps/backend/src/plugins/question-import/server/index.ts` — server exports
- `apps/backend/src/plugins/question-import/server/routes/index.ts`
- `apps/backend/src/plugins/question-import/server/controllers/import.ts`
- `apps/backend/src/plugins/question-import/server/services/normalize.ts`
- `apps/backend/src/plugins/question-import/server/services/embeddings.ts`
- `apps/backend/src/plugins/question-import/server/services/analyzer.ts`
- `apps/backend/src/plugins/question-import/server/services/import.ts`
- `apps/backend/src/plugins/question-import/admin/src/index.ts` — admin bootstrap
- `apps/backend/src/plugins/question-import/admin/src/pages/Upload.tsx`
- `apps/backend/src/plugins/question-import/admin/src/pages/Review.tsx`
- `apps/backend/src/plugins/question-import/admin/src/components/ConflictCard.tsx`
- `apps/backend/src/plugins/question-import/admin/src/components/SimilarityBar.tsx`
- `apps/backend/src/plugins/question-import/admin/src/lib/draftStore.ts`
- `apps/backend/src/plugins/question-import/admin/src/lib/api.ts`
- `apps/backend/tests/question-import/normalize.test.ts`
- `apps/backend/tests/question-import/analyzer.test.ts`
- `apps/backend/tests/question-import/embeddings.test.ts`
- `apps/backend/tests/question-import/preview.integration.test.ts`
- `apps/backend/tests/question-import/commit.integration.test.ts`
- `apps/backend/tests/mocks/openai-embeddings.ts`
- `apps/backend/scripts/backfill-embeddings.ts`

### Modified

- `package.json` (root) — add `bun run up` / `bun run down` (already done, validate in Task 1)
- `apps/backend/package.json` — add deps: `openai`, `pg`, `pgvector`, `pg-hstore`; add test script using `bun test`
- `apps/backend/.env.example` — add `DATABASE_CLIENT`, `DATABASE_URL`, `OPENAI_API_KEY`
- `apps/backend/config/plugins.ts` (create if missing) — register `question-import`

---

## Task 1: Validate Infra & Switch Strapi to Postgres

**Files:**
- Validate: `docker-compose.yml`
- Validate: `scripts/pg-init/01-enable-pgvector.sql`
- Validate: `package.json` (root) — has `up`/`down` scripts
- Modify: `apps/backend/.env.example`
- Modify: `apps/backend/.env` (local only, not committed)
- Modify: `apps/backend/package.json` — remove `better-sqlite3`, add `pg@^8.13.0`

- [ ] **Step 1: Bring up Postgres**

```bash
bun run up
```

Expected: container `quiz-app-postgres` becomes healthy.

- [ ] **Step 2: Verify pgvector extension**

```bash
docker exec quiz-app-postgres psql -U strapi -d quiz -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
```

Expected output:
```
 extname
---------
 vector
(1 row)
```

- [ ] **Step 3: Update `apps/backend/.env.example`**

Append to file:
```
# Database
DATABASE_CLIENT=postgres
DATABASE_URL=postgresql://strapi:strapi@localhost:5432/quiz

# OpenAI (for question-import plugin)
OPENAI_API_KEY=
```

- [ ] **Step 4: Update `apps/backend/.env`**

Add locally (do NOT commit):
```
DATABASE_CLIENT=postgres
DATABASE_URL=postgresql://strapi:strapi@localhost:5432/quiz
OPENAI_API_KEY=<your-key>
```

- [ ] **Step 5: Add Postgres driver, remove SQLite**

```bash
cd apps/backend
bun remove better-sqlite3
bun add pg@^8.13.0
```

- [ ] **Step 6: Boot Strapi against Postgres**

```bash
cd apps/backend
bun run strapi develop
```

Expected: Strapi starts without errors, creates all tables in Postgres. Ctrl+C after confirmation.

- [ ] **Step 7: Seed initial content**

```bash
cd apps/backend
bun run seed
```

Expected: success message with created packs/questions.

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml scripts/pg-init/ package.json apps/backend/package.json apps/backend/.env.example bun.lock
git commit -m "chore: switch Strapi to Postgres + pgvector via docker-compose"
```

---

## Task 2: Install Plugin Dependencies

**Files:**
- Modify: `apps/backend/package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Add runtime deps**

```bash
cd apps/backend
bun add openai@^4.70.0 pgvector@^0.2.0
```

- [ ] **Step 2: Add dev dep for UUID**

```bash
cd apps/backend
bun add uuid@^11.0.0
bun add -d @types/uuid@^10.0.0
```

- [ ] **Step 3: Enable `bun test` for backend**

Modify `apps/backend/package.json`:
```json
"scripts": {
  ...
  "test": "bun test tests/",
}
```

- [ ] **Step 4: Verify test runs with zero tests**

```bash
cd apps/backend
mkdir -p tests
bun test
```

Expected: `0 pass, 0 fail, Ran 0 tests`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/package.json bun.lock
git commit -m "chore: add openai, pgvector, uuid deps to backend"
```

---

## Task 3: Schema Migration — Add Embedding Columns

**Files:**
- Create: `apps/backend/database/migrations/2026-04-17T000000-add-question-embeddings.js`

Strapi migrations run on boot. We use a JS migration (Knex) because we need raw SQL for `vector` type.

- [ ] **Step 1: Write migration file**

Create `apps/backend/database/migrations/2026-04-17T000000-add-question-embeddings.js`:

```js
"use strict";

async function up(knex) {
  await knex.raw("CREATE EXTENSION IF NOT EXISTS vector;");

  const hasEmbedding = await knex.schema.hasColumn("questions", "embedding");
  if (!hasEmbedding) {
    await knex.raw(
      "ALTER TABLE questions ADD COLUMN embedding vector(1536);",
    );
  }

  const hasModel = await knex.schema.hasColumn("questions", "embedding_model");
  if (!hasModel) {
    await knex.raw(
      "ALTER TABLE questions ADD COLUMN embedding_model varchar(64);",
    );
  }

  const hasNorm = await knex.schema.hasColumn(
    "questions",
    "normalized_answer",
  );
  if (!hasNorm) {
    await knex.raw(
      "ALTER TABLE questions ADD COLUMN normalized_answer varchar(255) NOT NULL DEFAULT '';",
    );
  }

  await knex.raw(
    "CREATE INDEX IF NOT EXISTS questions_embedding_hnsw ON questions USING hnsw (embedding vector_cosine_ops);",
  );

  await knex.raw(
    "CREATE INDEX IF NOT EXISTS questions_normalized_answer ON questions (normalized_answer);",
  );
}

async function down(knex) {
  await knex.raw("DROP INDEX IF EXISTS questions_normalized_answer;");
  await knex.raw("DROP INDEX IF EXISTS questions_embedding_hnsw;");
  await knex.raw("ALTER TABLE questions DROP COLUMN IF EXISTS normalized_answer;");
  await knex.raw("ALTER TABLE questions DROP COLUMN IF EXISTS embedding_model;");
  await knex.raw("ALTER TABLE questions DROP COLUMN IF EXISTS embedding;");
}

module.exports = { up, down };
```

- [ ] **Step 2: Run Strapi to apply migration**

```bash
cd apps/backend
bun run strapi develop
```

Expected: Strapi boots, migration runs, no errors. Ctrl+C.

- [ ] **Step 3: Verify columns and indexes**

```bash
docker exec quiz-app-postgres psql -U strapi -d quiz -c "\d questions"
```

Expected: columns `embedding`, `embedding_model`, `normalized_answer` present. Indexes `questions_embedding_hnsw`, `questions_normalized_answer` listed.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/database/migrations/
git commit -m "feat(backend): add embedding columns + HNSW index to questions"
```

---

## Task 4: Normalize Service (TDD)

**Files:**
- Create: `apps/backend/tests/question-import/normalize.test.ts`
- Create: `apps/backend/src/plugins/question-import/server/services/normalize.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/backend/tests/question-import/normalize.test.ts`:

```ts
import { test, expect, describe } from "bun:test";
import { normalizeAnswer } from "../../src/plugins/question-import/server/services/normalize";

describe("normalizeAnswer", () => {
  test("lowercases", () => {
    expect(normalizeAnswer("Paris")).toBe("paris");
  });

  test("trims whitespace", () => {
    expect(normalizeAnswer("  paris  ")).toBe("paris");
  });

  test("removes accents", () => {
    expect(normalizeAnswer("Montréal")).toBe("montreal");
    expect(normalizeAnswer("Évian")).toBe("evian");
  });

  test("collapses whitespace", () => {
    expect(normalizeAnswer("la   ville  de   paris")).toBe("la ville de paris");
  });

  test("handles vrai_faux values", () => {
    expect(normalizeAnswer("true")).toBe("true");
    expect(normalizeAnswer("false")).toBe("false");
  });

  test("handles empty string", () => {
    expect(normalizeAnswer("")).toBe("");
  });

  test("combines all rules", () => {
    expect(normalizeAnswer("  La Ville de Montréal  ")).toBe(
      "la ville de montreal",
    );
  });
});
```

- [ ] **Step 2: Run the tests and confirm failure**

```bash
cd apps/backend
bun test tests/question-import/normalize.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

Create `apps/backend/src/plugins/question-import/server/services/normalize.ts`:

```ts
export function normalizeAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
```

- [ ] **Step 4: Run tests and confirm pass**

```bash
cd apps/backend
bun test tests/question-import/normalize.test.ts
```

Expected: `7 pass, 0 fail`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/question-import/server/services/normalize.ts apps/backend/tests/question-import/normalize.test.ts
git commit -m "feat(question-import): add normalizeAnswer service"
```

---

## Task 5: Mock Embedding Provider (Test Helper)

**Files:**
- Create: `apps/backend/tests/mocks/openai-embeddings.ts`

- [ ] **Step 1: Implement deterministic mock**

Create `apps/backend/tests/mocks/openai-embeddings.ts`:

```ts
import { createHash } from "node:crypto";

const DIM = 1536;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function hashToSeed(text: string): number {
  const h = createHash("sha256").update(text).digest();
  return h.readUInt32LE(0);
}

function vectorFromSeed(seed: number): number[] {
  const rand = seededRandom(seed);
  const vec: number[] = new Array(DIM);
  for (let i = 0; i < DIM; i++) vec[i] = rand() * 2 - 1;
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / norm);
}

/**
 * Returns a unit vector derived from the text.
 * Identical texts → identical vectors.
 * Slight lexical edits → high cosine similarity via shared base seed.
 */
export function mockEmbed(text: string): number[] {
  const normalized = text.toLowerCase().trim();
  return vectorFromSeed(hashToSeed(normalized));
}

/**
 * Returns a controlled blend of two seeds to craft test cases with
 * predictable similarities (e.g. `blendedEmbed('a', 'b', 0.9)` gives a
 * vector ~0.9 cosine similar to `mockEmbed('a')`).
 */
export function blendedEmbed(baseText: string, other: string, weight: number): number[] {
  const a = mockEmbed(baseText);
  const b = mockEmbed(other);
  const mixed = a.map((v, i) => v * weight + b[i] * (1 - weight));
  const norm = Math.sqrt(mixed.reduce((s, v) => s + v * v, 0));
  return mixed.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
```

- [ ] **Step 2: Verify determinism**

Run a one-off check:

```bash
cd apps/backend
bun -e 'import("./tests/mocks/openai-embeddings.ts").then(({ mockEmbed, cosineSimilarity }) => { const a = mockEmbed("Paris"); const b = mockEmbed("Paris"); console.log("equal:", cosineSimilarity(a, b).toFixed(4)); });'
```

Expected: `equal: 1.0000`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/tests/mocks/openai-embeddings.ts
git commit -m "test(question-import): add deterministic embedding mock"
```

---

## Task 6: Analyzer Service (TDD)

**Files:**
- Create: `apps/backend/tests/question-import/analyzer.test.ts`
- Create: `apps/backend/src/plugins/question-import/server/services/analyzer.ts`

The analyzer takes candidate embeddings + existing question matches and classifies status.

- [ ] **Step 1: Write failing tests**

Create `apps/backend/tests/question-import/analyzer.test.ts`:

```ts
import { test, expect, describe } from "bun:test";
import { classifyCandidate } from "../../src/plugins/question-import/server/services/analyzer";

type ExistingMatch = {
  questionId: number;
  text: string;
  packSlug: string;
  categoryName: string;
  similarity: number;
  normalizedAnswer: string;
};

describe("classifyCandidate", () => {
  const candidate = {
    normalizedAnswer: "paris",
  };

  test("no matches → clean", () => {
    const result = classifyCandidate(candidate, []);
    expect(result.status).toBe("clean");
  });

  test("match above 0.92 → auto_blocked (any answer)", () => {
    const matches: ExistingMatch[] = [
      {
        questionId: 1,
        text: "Capitale de la France ?",
        packSlug: "geo",
        categoryName: "Europe",
        similarity: 0.94,
        normalizedAnswer: "paris",
      },
    ];
    const result = classifyCandidate(candidate, matches);
    expect(result.status).toBe("auto_blocked");
  });

  test("match 0.88 same answer → needs_review", () => {
    const matches: ExistingMatch[] = [
      {
        questionId: 1,
        text: "Quelle ville est la capitale française ?",
        packSlug: "geo",
        categoryName: "Europe",
        similarity: 0.88,
        normalizedAnswer: "paris",
      },
    ];
    const result = classifyCandidate(candidate, matches);
    expect(result.status).toBe("needs_review");
  });

  test("match 0.88 different answer → clean", () => {
    const matches: ExistingMatch[] = [
      {
        questionId: 1,
        text: "Plus grande ville de France ?",
        packSlug: "geo",
        categoryName: "Europe",
        similarity: 0.88,
        normalizedAnswer: "lyon",
      },
    ];
    const result = classifyCandidate(candidate, matches);
    expect(result.status).toBe("clean");
  });

  test("match below 0.85 → clean even with same answer", () => {
    const matches: ExistingMatch[] = [
      {
        questionId: 1,
        text: "unrelated",
        packSlug: "x",
        categoryName: "y",
        similarity: 0.80,
        normalizedAnswer: "paris",
      },
    ];
    const result = classifyCandidate(candidate, matches);
    expect(result.status).toBe("clean");
  });

  test("worst status wins across multiple matches", () => {
    const matches: ExistingMatch[] = [
      { questionId: 1, text: "a", packSlug: "p", categoryName: "c", similarity: 0.70, normalizedAnswer: "other" },
      { questionId: 2, text: "b", packSlug: "p", categoryName: "c", similarity: 0.88, normalizedAnswer: "paris" },
      { questionId: 3, text: "c", packSlug: "p", categoryName: "c", similarity: 0.95, normalizedAnswer: "paris" },
    ];
    const result = classifyCandidate(candidate, matches);
    expect(result.status).toBe("auto_blocked");
  });

  test("returned sameAnswer flag reflects comparison", () => {
    const matches: ExistingMatch[] = [
      { questionId: 1, text: "t", packSlug: "p", categoryName: "c", similarity: 0.88, normalizedAnswer: "paris" },
      { questionId: 2, text: "t", packSlug: "p", categoryName: "c", similarity: 0.88, normalizedAnswer: "lyon" },
    ];
    const result = classifyCandidate(candidate, matches);
    expect(result.matches[0].sameAnswer).toBe(true);
    expect(result.matches[1].sameAnswer).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
cd apps/backend
bun test tests/question-import/analyzer.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement analyzer**

Create `apps/backend/src/plugins/question-import/server/services/analyzer.ts`:

```ts
export const THRESHOLD_BLOCK = 0.92;
export const THRESHOLD_REVIEW = 0.85;

export type CandidateStatus =
  | "clean"
  | "needs_review"
  | "auto_blocked"
  | "intra_batch_duplicate";

export interface CandidateInput {
  normalizedAnswer: string;
}

export interface ExistingMatch {
  questionId: number;
  text: string;
  packSlug: string;
  categoryName: string;
  similarity: number;
  normalizedAnswer: string;
}

export interface ClassifiedMatch extends ExistingMatch {
  sameAnswer: boolean;
}

export interface ClassifiedCandidate {
  status: CandidateStatus;
  matches: ClassifiedMatch[];
}

function severity(status: CandidateStatus): number {
  switch (status) {
    case "auto_blocked":
      return 3;
    case "intra_batch_duplicate":
      return 2;
    case "needs_review":
      return 1;
    case "clean":
      return 0;
  }
}

export function classifyCandidate(
  candidate: CandidateInput,
  matches: ExistingMatch[],
): ClassifiedCandidate {
  const classifiedMatches: ClassifiedMatch[] = matches.map((m) => ({
    ...m,
    sameAnswer: m.normalizedAnswer === candidate.normalizedAnswer,
  }));

  let status: CandidateStatus = "clean";

  for (const m of classifiedMatches) {
    let matchStatus: CandidateStatus = "clean";
    if (m.similarity >= THRESHOLD_BLOCK) {
      matchStatus = "auto_blocked";
    } else if (m.similarity >= THRESHOLD_REVIEW && m.sameAnswer) {
      matchStatus = "needs_review";
    }
    if (severity(matchStatus) > severity(status)) {
      status = matchStatus;
    }
  }

  return { status, matches: classifiedMatches };
}

/**
 * Given a list of candidates with their embeddings, finds intra-batch
 * duplicates by pairwise cosine. Returns the indices that should be
 * marked intra_batch_duplicate (keeps the first occurrence, flags later).
 */
export function detectIntraBatchDuplicates(
  candidates: Array<{ embedding: number[]; normalizedAnswer: string }>,
): Set<number> {
  const duplicates = new Set<number>();
  for (let i = 0; i < candidates.length; i++) {
    if (duplicates.has(i)) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      if (duplicates.has(j)) continue;
      const sim = cosine(candidates[i].embedding, candidates[j].embedding);
      const sameAns =
        candidates[i].normalizedAnswer === candidates[j].normalizedAnswer;
      if (sim >= THRESHOLD_BLOCK) {
        duplicates.add(j);
      } else if (sim >= THRESHOLD_REVIEW && sameAns) {
        duplicates.add(j);
      }
    }
  }
  return duplicates;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
cd apps/backend
bun test tests/question-import/analyzer.test.ts
```

Expected: `7 pass, 0 fail`.

- [ ] **Step 5: Add intra-batch dedup tests**

Append to `apps/backend/tests/question-import/analyzer.test.ts`:

```ts
import { detectIntraBatchDuplicates } from "../../src/plugins/question-import/server/services/analyzer";
import { mockEmbed, blendedEmbed } from "../mocks/openai-embeddings";

describe("detectIntraBatchDuplicates", () => {
  test("empty batch → empty set", () => {
    expect(detectIntraBatchDuplicates([]).size).toBe(0);
  });

  test("unique batch → empty set", () => {
    const items = [
      { embedding: mockEmbed("A"), normalizedAnswer: "x" },
      { embedding: mockEmbed("B"), normalizedAnswer: "y" },
    ];
    expect(detectIntraBatchDuplicates(items).size).toBe(0);
  });

  test("identical candidates → later one flagged", () => {
    const items = [
      { embedding: mockEmbed("same"), normalizedAnswer: "x" },
      { embedding: mockEmbed("same"), normalizedAnswer: "x" },
    ];
    const dup = detectIntraBatchDuplicates(items);
    expect(dup.has(0)).toBe(false);
    expect(dup.has(1)).toBe(true);
  });

  test("near-duplicate with same answer → later flagged", () => {
    const items = [
      { embedding: mockEmbed("base"), normalizedAnswer: "x" },
      { embedding: blendedEmbed("base", "other", 0.9), normalizedAnswer: "x" },
    ];
    const dup = detectIntraBatchDuplicates(items);
    expect(dup.has(1)).toBe(true);
  });

  test("near-duplicate with different answer → not flagged", () => {
    const items = [
      { embedding: mockEmbed("base"), normalizedAnswer: "x" },
      { embedding: blendedEmbed("base", "other", 0.87), normalizedAnswer: "y" },
    ];
    const dup = detectIntraBatchDuplicates(items);
    expect(dup.has(1)).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests, confirm pass**

```bash
cd apps/backend
bun test tests/question-import/analyzer.test.ts
```

Expected: `12 pass, 0 fail`.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/plugins/question-import/server/services/analyzer.ts apps/backend/tests/question-import/analyzer.test.ts
git commit -m "feat(question-import): add analyzer classification service"
```

---

## Task 7: Embeddings Service (TDD with Mocked OpenAI)

**Files:**
- Create: `apps/backend/tests/question-import/embeddings.test.ts`
- Create: `apps/backend/src/plugins/question-import/server/services/embeddings.ts`

The service exposes a single method `embedBatch(texts: string[]): Promise<number[][]>` and caches per-text hashes in memory.

- [ ] **Step 1: Write failing tests**

Create `apps/backend/tests/question-import/embeddings.test.ts`:

```ts
import { test, expect, describe, mock } from "bun:test";
import { createEmbeddingService } from "../../src/plugins/question-import/server/services/embeddings";

function makeFakeClient(returnVec = (t: string) => [t.length, 0, 0]) {
  const calls: string[][] = [];
  return {
    calls,
    embeddings: {
      create: async ({ input }: { input: string[] }) => {
        calls.push(input);
        return {
          data: input.map((t) => ({ embedding: returnVec(t) })),
        };
      },
    },
  };
}

describe("embeddings service", () => {
  test("batches all texts in a single API call", async () => {
    const client = makeFakeClient();
    const svc = createEmbeddingService({ client: client as any, model: "test" });
    const result = await svc.embedBatch(["a", "b", "c"]);
    expect(client.calls.length).toBe(1);
    expect(client.calls[0]).toEqual(["a", "b", "c"]);
    expect(result.length).toBe(3);
  });

  test("cache hits skip the API", async () => {
    const client = makeFakeClient();
    const svc = createEmbeddingService({ client: client as any, model: "test" });
    await svc.embedBatch(["hello"]);
    await svc.embedBatch(["hello"]);
    expect(client.calls.length).toBe(1);
  });

  test("partial cache hit → only missing texts sent", async () => {
    const client = makeFakeClient();
    const svc = createEmbeddingService({ client: client as any, model: "test" });
    await svc.embedBatch(["a", "b"]);
    await svc.embedBatch(["b", "c", "a"]);
    expect(client.calls[1]).toEqual(["c"]);
  });

  test("preserves order of input in result", async () => {
    const client = makeFakeClient((t) => [t.charCodeAt(0), 0, 0]);
    const svc = createEmbeddingService({ client: client as any, model: "test" });
    const [va, vb] = await svc.embedBatch(["a", "b"]);
    expect(va[0]).toBe("a".charCodeAt(0));
    expect(vb[0]).toBe("b".charCodeAt(0));
  });

  test("throws when OpenAI client errors", async () => {
    const client = {
      embeddings: {
        create: async () => {
          throw new Error("rate limit");
        },
      },
    };
    const svc = createEmbeddingService({ client: client as any, model: "test" });
    expect(svc.embedBatch(["x"])).rejects.toThrow("rate limit");
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
cd apps/backend
bun test tests/question-import/embeddings.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement embeddings service**

Create `apps/backend/src/plugins/question-import/server/services/embeddings.ts`:

```ts
import { createHash } from "node:crypto";
import OpenAI from "openai";

export interface EmbeddingService {
  embedBatch(texts: string[]): Promise<number[][]>;
}

interface EmbeddingClient {
  embeddings: {
    create(args: { model: string; input: string[] }): Promise<{
      data: Array<{ embedding: number[] }>;
    }>;
  };
}

interface Options {
  client: EmbeddingClient;
  model: string;
  cacheSize?: number;
}

export function createEmbeddingService(opts: Options): EmbeddingService {
  const cache = new Map<string, number[]>();
  const maxSize = opts.cacheSize ?? 1000;

  function cacheKey(text: string): string {
    return createHash("sha256").update(text).digest("hex");
  }

  function get(text: string): number[] | undefined {
    return cache.get(cacheKey(text));
  }

  function put(text: string, vec: number[]): void {
    const key = cacheKey(text);
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, vec);
  }

  return {
    async embedBatch(texts) {
      const missing: string[] = [];
      const missingSet = new Set<string>();
      for (const t of texts) {
        if (!get(t) && !missingSet.has(t)) {
          missing.push(t);
          missingSet.add(t);
        }
      }

      if (missing.length > 0) {
        const resp = await opts.client.embeddings.create({
          model: opts.model,
          input: missing,
        });
        resp.data.forEach((d, i) => put(missing[i], d.embedding));
      }

      return texts.map((t) => {
        const vec = get(t);
        if (!vec) throw new Error(`Missing embedding for text: ${t}`);
        return vec;
      });
    },
  };
}

/**
 * Default factory used at runtime — reads the OpenAI key from env.
 */
export function createDefaultEmbeddingService(): EmbeddingService {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set — cannot use question-import plugin",
    );
  }
  const client = new OpenAI({ apiKey }) as unknown as EmbeddingClient;
  return createEmbeddingService({
    client,
    model: "text-embedding-3-small",
  });
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
cd apps/backend
bun test tests/question-import/embeddings.test.ts
```

Expected: `5 pass, 0 fail`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/question-import/server/services/embeddings.ts apps/backend/tests/question-import/embeddings.test.ts
git commit -m "feat(question-import): add embeddings service with in-memory cache"
```

---

## Task 8: Plugin Scaffold

**Files:**
- Create: `apps/backend/src/plugins/question-import/package.json`
- Create: `apps/backend/src/plugins/question-import/strapi-server.ts`
- Create: `apps/backend/src/plugins/question-import/strapi-admin.ts`
- Create: `apps/backend/src/plugins/question-import/server/index.ts`
- Create: `apps/backend/src/plugins/question-import/server/routes/index.ts`
- Create: `apps/backend/src/plugins/question-import/server/controllers/import.ts` (stub)
- Create: `apps/backend/src/plugins/question-import/admin/src/index.ts`
- Create: `apps/backend/config/plugins.ts` (or modify if exists)

- [ ] **Step 1: Plugin manifest**

Create `apps/backend/src/plugins/question-import/package.json`:

```json
{
  "name": "question-import",
  "version": "0.1.0",
  "strapi": {
    "displayName": "Question Import",
    "name": "question-import",
    "description": "AI-assisted question import with semantic deduplication",
    "kind": "plugin"
  }
}
```

- [ ] **Step 2: Server bootstrap**

Create `apps/backend/src/plugins/question-import/strapi-server.ts`:

```ts
import routes from "./server/routes";
import importController from "./server/controllers/import";

export default {
  register() {},
  bootstrap() {},
  routes,
  controllers: {
    "import": importController,
  },
};
```

- [ ] **Step 3: Admin bootstrap (placeholder)**

Create `apps/backend/src/plugins/question-import/strapi-admin.ts`:

```ts
export default {
  register(app: any) {
    app.registerPlugin({
      id: "question-import",
      name: "Question Import",
    });
  },
  bootstrap() {},
};
```

- [ ] **Step 4: Routes module**

Create `apps/backend/src/plugins/question-import/server/routes/index.ts`:

```ts
export default {
  admin: {
    type: "admin",
    routes: [
      {
        method: "POST",
        path: "/preview",
        handler: "import.preview",
        config: { policies: ["admin::isAuthenticatedAdmin"] },
      },
      {
        method: "POST",
        path: "/commit",
        handler: "import.commit",
        config: { policies: ["admin::isAuthenticatedAdmin"] },
      },
    ],
  },
};
```

- [ ] **Step 5: Controller stubs**

Create `apps/backend/src/plugins/question-import/server/controllers/import.ts`:

```ts
import type { Context } from "koa";

export default {
  async preview(ctx: Context) {
    ctx.status = 501;
    ctx.body = { error: "not implemented" };
  },
  async commit(ctx: Context) {
    ctx.status = 501;
    ctx.body = { error: "not implemented" };
  },
};
```

- [ ] **Step 6: Admin stub**

Create `apps/backend/src/plugins/question-import/admin/src/index.ts`:

```ts
export default {
  register(app: any) {
    app.addMenuLink({
      to: "/plugins/question-import",
      icon: () => null,
      intlLabel: {
        id: "question-import.plugin.name",
        defaultMessage: "Question Import",
      },
      Component: async () => {
        const component = await import("./pages/Upload");
        return component;
      },
      permissions: [],
    });
  },
  bootstrap() {},
};
```

- [ ] **Step 7: Register plugin in Strapi config**

Check `apps/backend/config/plugins.ts` — create if absent, otherwise merge:

```ts
export default () => ({
  "question-import": {
    enabled: true,
    resolve: "./src/plugins/question-import",
  },
});
```

- [ ] **Step 8: Pages placeholder (so admin boot doesn't crash)**

Create `apps/backend/src/plugins/question-import/admin/src/pages/Upload.tsx`:

```tsx
export default function Upload() {
  return <div>Question Import — Upload (placeholder)</div>;
}
```

- [ ] **Step 9: Boot and sanity check**

```bash
cd apps/backend
bun run strapi develop
```

Expected: Strapi boots, admin loads. Visit `http://localhost:1337/admin` — "Question Import" visible in the menu. POSTing to `/question-import/preview` returns 501. Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/src/plugins/question-import apps/backend/config/plugins.ts
git commit -m "feat(question-import): scaffold plugin skeleton"
```

---

## Task 9: Import Service — Preview Logic

**Files:**
- Create: `apps/backend/src/plugins/question-import/server/services/import.ts`
- Create: `apps/backend/tests/question-import/preview.integration.test.ts`

This service orchestrates: validate body → normalize → embed → kNN search → classify. Returns the preview response. No DB writes.

- [ ] **Step 1: Write the service signature and validation re-use**

Create `apps/backend/src/plugins/question-import/server/services/import.ts`:

```ts
import { v4 as uuid } from "uuid";
import pgvector from "pgvector/utils";
import type { EmbeddingService } from "./embeddings";
import { normalizeAnswer } from "./normalize";
import {
  classifyCandidate,
  detectIntraBatchDuplicates,
  type ClassifiedCandidate,
} from "./analyzer";

export interface ImportPack {
  slug?: string;
  name?: string;
  description?: string;
  icon?: string;
  gradient?: string;
}

export interface ImportQuestion {
  category?: string;
  type?: string;
  question?: string;
  choices?: unknown;
  answer?: string;
}

export interface ImportBody {
  pack?: ImportPack;
  questions?: ImportQuestion[];
}

export interface PreviewCandidate {
  index: number;
  question: string;
  normalizedAnswer: string;
  embedding: number[];
  status: ClassifiedCandidate["status"];
  matches: ClassifiedCandidate["matches"];
}

export interface PreviewResult {
  previewId: string;
  embeddingModel: string;
  candidates: PreviewCandidate[];
}

const VALID_TYPES = ["qcm", "vrai_faux", "texte"] as const;

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
  for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i];
    const p = `questions[${i}]`;
    if (!q.category) errors.push(`${p}.category is required`);
    if (!q.type || !VALID_TYPES.includes(q.type as any)) errors.push(`${p}.type invalid`);
    if (!q.question) errors.push(`${p}.question is required`);
    if (!q.answer) errors.push(`${p}.answer is required`);
    if (q.type === "qcm") {
      if (!Array.isArray(q.choices) || q.choices.length !== 4 || !q.choices.every((c) => typeof c === "string")) {
        errors.push(`${p}.choices must be exactly 4 strings for qcm`);
      }
    }
    if (q.type === "vrai_faux" && q.answer !== "true" && q.answer !== "false") {
      errors.push(`${p}.answer must be "true" or "false" for vrai_faux`);
    }
  }
  return errors;
}

export interface KnnSearchInput {
  embedding: number[];
  limit: number;
}

export interface KnnRow {
  questionId: number;
  text: string;
  packSlug: string;
  categoryName: string;
  similarity: number;
  normalizedAnswer: string;
}

export interface KnnSearcher {
  search(input: KnnSearchInput): Promise<KnnRow[]>;
}

export interface PreviewDeps {
  embeddings: EmbeddingService;
  knn: KnnSearcher;
  model: string;
}

export async function runPreview(
  body: ImportBody,
  deps: PreviewDeps,
): Promise<PreviewResult> {
  const errors = validateImportBody(body);
  if (errors.length > 0) {
    const err = new Error("Validation failed") as Error & { details?: string[] };
    err.details = errors;
    throw err;
  }
  const questions = body.questions as ImportQuestion[];

  const texts = questions.map((q) => q.question as string);
  const embeddings = await deps.embeddings.embedBatch(texts);

  const normalized = questions.map((q) => normalizeAnswer(q.answer as string));

  const intraBatchDuplicates = detectIntraBatchDuplicates(
    embeddings.map((e, i) => ({ embedding: e, normalizedAnswer: normalized[i] })),
  );

  const candidates: PreviewCandidate[] = [];
  for (let i = 0; i < questions.length; i++) {
    const existing = await deps.knn.search({ embedding: embeddings[i], limit: 10 });
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

  return {
    previewId: uuid(),
    embeddingModel: deps.model,
    candidates,
  };
}

/**
 * Knex-backed KNN searcher against the `questions` table.
 */
export function createKnnSearcher(knex: any): KnnSearcher {
  return {
    async search({ embedding, limit }) {
      const vec = pgvector.toSql(embedding);
      const rows = await knex.raw(
        `
        SELECT
          q.id AS "questionId",
          q.text AS "text",
          p.slug AS "packSlug",
          COALESCE(c.name, '') AS "categoryName",
          q.normalized_answer AS "normalizedAnswer",
          1 - (q.embedding <=> ?::vector) AS similarity
        FROM questions q
        LEFT JOIN question_packs p ON q.pack_id = p.id
        LEFT JOIN categories c ON q.category_id = c.id
        WHERE q.embedding IS NOT NULL
        ORDER BY q.embedding <=> ?::vector
        LIMIT ?;
      `,
        [vec, vec, limit],
      );
      return rows.rows.map((r: any) => ({
        questionId: r.questionId,
        text: r.text,
        packSlug: r.packSlug,
        categoryName: r.categoryName,
        similarity: Number(r.similarity),
        normalizedAnswer: r.normalizedAnswer,
      }));
    },
  };
}
```

- [ ] **Step 2: Write integration tests for runPreview**

Create `apps/backend/tests/question-import/preview.integration.test.ts`:

```ts
import { test, expect, describe } from "bun:test";
import {
  runPreview,
  type KnnSearcher,
  type KnnRow,
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

function fakeKnn(rows: KnnRow[]): KnnSearcher {
  return { search: async () => rows };
}

const embeddings = createEmbeddingService({
  client: fakeOpenAIClient() as any,
  model: "test",
});

const samplePack = { slug: "geo-fr", name: "Géo France" };

function qcm(text: string, answer: string, category = "Europe") {
  return {
    category,
    type: "qcm",
    question: text,
    choices: ["A", "B", "C", "D"],
    answer,
  };
}

describe("runPreview", () => {
  test("marks all clean when no existing matches", async () => {
    const body = {
      pack: samplePack,
      questions: [qcm("Capitale de la France ?", "Paris")],
    };
    const result = await runPreview(body, {
      embeddings,
      knn: fakeKnn([]),
      model: "test",
    });
    expect(result.candidates[0].status).toBe("clean");
  });

  test("auto_blocked when KNN returns ≥ 0.92 similarity", async () => {
    const body = {
      pack: samplePack,
      questions: [qcm("Capitale de la France ?", "Paris")],
    };
    const row: KnnRow = {
      questionId: 42,
      text: "Capitale française ?",
      packSlug: "other",
      categoryName: "Europe",
      similarity: 0.95,
      normalizedAnswer: "paris",
    };
    const result = await runPreview(body, {
      embeddings,
      knn: fakeKnn([row]),
      model: "test",
    });
    expect(result.candidates[0].status).toBe("auto_blocked");
  });

  test("needs_review when similarity in 0.85-0.92 and same answer", async () => {
    const body = {
      pack: samplePack,
      questions: [qcm("Capitale de la France ?", "Paris")],
    };
    const row: KnnRow = {
      questionId: 42,
      text: "Quelle ville est la capitale française ?",
      packSlug: "other",
      categoryName: "Europe",
      similarity: 0.88,
      normalizedAnswer: "paris",
    };
    const result = await runPreview(body, {
      embeddings,
      knn: fakeKnn([row]),
      model: "test",
    });
    expect(result.candidates[0].status).toBe("needs_review");
  });

  test("clean when same similarity range but different answer", async () => {
    const body = {
      pack: samplePack,
      questions: [qcm("Capitale de la France ?", "Paris")],
    };
    const row: KnnRow = {
      questionId: 42,
      text: "Plus grande ville ?",
      packSlug: "other",
      categoryName: "Europe",
      similarity: 0.88,
      normalizedAnswer: "lyon",
    };
    const result = await runPreview(body, {
      embeddings,
      knn: fakeKnn([row]),
      model: "test",
    });
    expect(result.candidates[0].status).toBe("clean");
  });

  test("intra_batch_duplicate flagged on second identical question", async () => {
    const body = {
      pack: samplePack,
      questions: [
        qcm("Capitale de la France ?", "Paris"),
        qcm("Capitale de la France ?", "Paris"),
      ],
    };
    const result = await runPreview(body, {
      embeddings,
      knn: fakeKnn([]),
      model: "test",
    });
    expect(result.candidates[0].status).toBe("clean");
    expect(result.candidates[1].status).toBe("intra_batch_duplicate");
  });

  test("rejects invalid body with errors", async () => {
    const body = { pack: { slug: "" }, questions: [] };
    expect(
      runPreview(body, { embeddings, knn: fakeKnn([]), model: "test" }),
    ).rejects.toThrow("Validation failed");
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd apps/backend
bun test tests/question-import/preview.integration.test.ts
```

Expected: `6 pass, 0 fail`.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/plugins/question-import/server/services/import.ts apps/backend/tests/question-import/preview.integration.test.ts
git commit -m "feat(question-import): add preview orchestration service"
```

---

## Task 10: Wire the `/preview` Controller

**Files:**
- Modify: `apps/backend/src/plugins/question-import/server/controllers/import.ts`

- [ ] **Step 1: Replace preview stub with real implementation**

Replace `apps/backend/src/plugins/question-import/server/controllers/import.ts`:

```ts
import type { Context } from "koa";
import { runPreview, createKnnSearcher } from "../services/import";
import { createDefaultEmbeddingService } from "../services/embeddings";

const MODEL = "text-embedding-3-small";

export default {
  async preview(ctx: Context) {
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
      ctx.status = 500;
      ctx.body = { success: false, error: (err as Error).message };
    }
  },

  async commit(ctx: Context) {
    ctx.status = 501;
    ctx.body = { error: "not implemented" };
  },
};
```

- [ ] **Step 2: Manual smoke test**

Start Strapi, then curl:

```bash
cd apps/backend && bun run strapi develop
# in another terminal, after login to admin to get JWT (or use a dev token if configured):
curl -X POST http://localhost:1337/question-import/preview \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"pack":{"slug":"test","name":"Test"},"questions":[{"category":"X","type":"qcm","question":"Test ?","choices":["A","B","C","D"],"answer":"A"}]}'
```

Expected: JSON with `previewId`, `candidates[0].status = "clean"` (assuming empty corpus).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/plugins/question-import/server/controllers/import.ts
git commit -m "feat(question-import): wire /preview endpoint"
```

---

## Task 11: Commit Endpoint — Service Layer

**Files:**
- Modify: `apps/backend/src/plugins/question-import/server/services/import.ts`
- Create: `apps/backend/tests/question-import/commit.integration.test.ts`

The commit service takes the decisions from the review UI and writes pack/categories/questions, persisting embedding + normalized_answer.

- [ ] **Step 1: Extend import.ts with commit types & service**

Append to `apps/backend/src/plugins/question-import/server/services/import.ts`:

```ts
export type QuestionDecision = "import" | "skip";

export interface CommitQuestion extends ImportQuestion {
  embedding: number[];
  normalizedAnswer: string;
  status: ClassifiedCandidate["status"] | "intra_batch_duplicate";
  decision: QuestionDecision;
  overrideReason?: string;
}

export interface CommitBody {
  pack: ImportPack & { slug: string };
  embeddingModel: string;
  questions: CommitQuestion[];
}

export interface CommitSummary {
  pack: { slug: string; status: "created" | "existing" };
  categories: Array<{ name: string; status: "created" | "existing" }>;
  questions: { created: number; skipped: number; total: number };
}

export interface CommitDeps {
  strapi: any; // global strapi singleton
}

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
    if (!["import", "skip"].includes(q.decision)) {
      errors.push(`${p}.decision must be import|skip`);
    }
    if (
      q.status === "auto_blocked" &&
      q.decision === "import" &&
      (!q.overrideReason || q.overrideReason.trim() === "")
    ) {
      errors.push(`${p}.overrideReason required when overriding auto_blocked`);
    }
    if (q.decision === "import") {
      if (!Array.isArray(q.embedding) || q.embedding.length !== 1536) {
        errors.push(`${p}.embedding must be 1536-dim array`);
      }
    }
  }
  return errors;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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
  const { strapi } = deps;

  // Upsert pack
  let pack: any = await strapi
    .documents("api::question-pack.question-pack")
    .findFirst({ filters: { slug: body.pack.slug } });
  let packStatus: "created" | "existing" = "existing";
  if (!pack) {
    pack = await strapi.documents("api::question-pack.question-pack").create({
      data: {
        slug: body.pack.slug,
        name: body.pack.name as string,
        description: body.pack.description ?? null,
        icon: body.pack.icon ?? null,
        gradient: body.pack.gradient ?? null,
        isFree: true,
      },
    });
    packStatus = "created";
  }

  // Upsert categories
  const toImport = body.questions.filter((q) => q.decision === "import");
  const uniqueCategoryNames = [...new Set(toImport.map((q) => q.category as string))];
  const catSummary: Array<{ name: string; status: "created" | "existing" }> = [];
  const catMap = new Map<string, any>();

  for (const name of uniqueCategoryNames) {
    let cat = await strapi.documents("api::category.category").findFirst({
      filters: { name },
      populate: ["packs"],
    });
    let status: "created" | "existing" = "existing";
    if (!cat) {
      const created = await strapi.documents("api::category.category").create({
        data: { name, slug: slugify(name) },
      });
      cat = await strapi.documents("api::category.category").findFirst({
        filters: { documentId: created.documentId },
        populate: ["packs"],
      });
      status = "created";
    }
    const linked: string[] = (cat.packs ?? []).map((p: any) => p.documentId);
    if (!linked.includes(pack.documentId)) {
      await strapi.documents("api::category.category").update({
        documentId: cat.documentId,
        data: { packs: [...linked, pack.documentId] },
      });
    }
    catMap.set(name, cat);
    catSummary.push({ name, status });
  }

  // Create questions
  let created = 0;
  for (const q of toImport) {
    const cat = catMap.get(q.category as string);
    const doc = await strapi.documents("api::question.question").create({
      data: {
        type: q.type as "qcm" | "vrai_faux" | "texte",
        text: q.question as string,
        choices: q.type === "qcm" ? (q.choices as string[]) : null,
        answer: q.answer as string,
        category: cat?.documentId,
        pack: pack.documentId,
      },
    });
    // Patch embedding + normalized_answer via raw knex since they're not
    // Strapi-managed attributes in the schema.
    await strapi.db.connection.raw(
      `UPDATE questions
       SET embedding = ?::vector,
           embedding_model = ?,
           normalized_answer = ?
       WHERE document_id = ?`,
      [
        JSON.stringify(q.embedding),
        body.embeddingModel,
        q.normalizedAnswer,
        doc.documentId,
      ],
    );
    created++;
  }

  return {
    pack: { slug: pack.slug, status: packStatus },
    categories: catSummary,
    questions: {
      created,
      skipped: body.questions.length - created,
      total: body.questions.length,
    },
  };
}
```

- [ ] **Step 2: Write validation-focused tests**

Create `apps/backend/tests/question-import/commit.integration.test.ts`:

```ts
import { test, expect, describe } from "bun:test";
import { validateCommitBody } from "../../src/plugins/question-import/server/services/import";

const vec = new Array(1536).fill(0);

function baseBody(overrides: any = {}) {
  return {
    pack: { slug: "p", name: "P" },
    embeddingModel: "text-embedding-3-small",
    questions: [
      {
        category: "C",
        type: "qcm",
        question: "Q",
        choices: ["a", "b", "c", "d"],
        answer: "a",
        embedding: vec,
        normalizedAnswer: "a",
        status: "clean",
        decision: "import",
      },
    ],
    ...overrides,
  };
}

describe("validateCommitBody", () => {
  test("valid body → no errors", () => {
    expect(validateCommitBody(baseBody())).toEqual([]);
  });

  test("missing pack.slug → error", () => {
    const body = baseBody({ pack: { name: "P" } });
    expect(validateCommitBody(body)).toContain("pack.slug required");
  });

  test("auto_blocked override without reason → error", () => {
    const body = baseBody({
      questions: [
        {
          ...baseBody().questions[0],
          status: "auto_blocked",
          decision: "import",
          overrideReason: "",
        },
      ],
    });
    expect(validateCommitBody(body)[0]).toMatch(/overrideReason/);
  });

  test("auto_blocked override with reason → no error", () => {
    const body = baseBody({
      questions: [
        {
          ...baseBody().questions[0],
          status: "auto_blocked",
          decision: "import",
          overrideReason: "duplicate is intentional",
        },
      ],
    });
    expect(validateCommitBody(body)).toEqual([]);
  });

  test("wrong embedding dim → error", () => {
    const body = baseBody({
      questions: [{ ...baseBody().questions[0], embedding: [1, 2, 3] }],
    });
    expect(validateCommitBody(body)[0]).toMatch(/1536/);
  });

  test("skip decision doesn't require embedding", () => {
    const body = baseBody({
      questions: [
        {
          ...baseBody().questions[0],
          embedding: [],
          decision: "skip",
        },
      ],
    });
    expect(validateCommitBody(body)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd apps/backend
bun test tests/question-import/commit.integration.test.ts
```

Expected: `6 pass, 0 fail`.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/plugins/question-import/server/services/import.ts apps/backend/tests/question-import/commit.integration.test.ts
git commit -m "feat(question-import): add commit service with validation"
```

---

## Task 12: Wire the `/commit` Controller

**Files:**
- Modify: `apps/backend/src/plugins/question-import/server/controllers/import.ts`

- [ ] **Step 1: Replace commit stub**

Update `apps/backend/src/plugins/question-import/server/controllers/import.ts` — replace the `commit` handler:

```ts
import type { Context } from "koa";
import { runPreview, runCommit, createKnnSearcher } from "../services/import";
import { createDefaultEmbeddingService } from "../services/embeddings";

const MODEL = "text-embedding-3-small";

export default {
  async preview(ctx: Context) {
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
      ctx.status = 500;
      ctx.body = { success: false, error: (err as Error).message };
    }
  },

  async commit(ctx: Context) {
    try {
      const summary = await runCommit(ctx.request.body as any, { strapi });
      ctx.body = { success: true, summary };
    } catch (err) {
      const details = (err as any).details;
      if (details) {
        ctx.status = 400;
        ctx.body = { success: false, errors: details };
        return;
      }
      ctx.status = 500;
      ctx.body = { success: false, error: (err as Error).message };
    }
  },
};
```

- [ ] **Step 2: Smoke test end-to-end**

```bash
cd apps/backend && bun run strapi develop
```

Then:
```bash
curl -X POST http://localhost:1337/question-import/preview -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" -d @sample-import.json
# Take the previewId + candidates and craft a commit body
curl -X POST http://localhost:1337/question-import/commit -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" -d @sample-commit.json
```

Expected: `success: true, summary: { pack, categories, questions: { created, ... } }`.

Verify in DB:
```bash
docker exec quiz-app-postgres psql -U strapi -d quiz -c "SELECT text, embedding_model, normalized_answer FROM questions LIMIT 5;"
```

Expected: new rows with populated `embedding_model` and `normalized_answer`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/plugins/question-import/server/controllers/import.ts
git commit -m "feat(question-import): wire /commit endpoint"
```

---

## Task 13: Admin — API Client & Draft Store

**Files:**
- Modify: `apps/backend/package.json` — add `idb-keyval`
- Create: `apps/backend/src/plugins/question-import/admin/src/lib/api.ts`
- Create: `apps/backend/src/plugins/question-import/admin/src/lib/draftStore.ts`

- [ ] **Step 1: Add IndexedDB wrapper dep**

```bash
cd apps/backend
bun add idb-keyval@^6.2.0
```

- [ ] **Step 2: Write API client**

Create `apps/backend/src/plugins/question-import/admin/src/lib/api.ts`:

```ts
import { getFetchClient } from "@strapi/strapi/admin";

export interface PreviewRequest {
  pack: any;
  questions: any[];
}

export interface PreviewCandidate {
  index: number;
  question: string;
  normalizedAnswer: string;
  embedding: number[];
  status: "clean" | "needs_review" | "auto_blocked" | "intra_batch_duplicate";
  matches: Array<{
    questionId: number;
    text: string;
    packSlug: string;
    categoryName: string;
    similarity: number;
    sameAnswer: boolean;
  }>;
}

export interface PreviewResponse {
  previewId: string;
  embeddingModel: string;
  candidates: PreviewCandidate[];
}

export async function postPreview(
  body: PreviewRequest,
): Promise<PreviewResponse> {
  const { post } = getFetchClient();
  const { data } = await post("/question-import/preview", body);
  return data;
}

export interface CommitDecision {
  embedding: number[];
  normalizedAnswer: string;
  status: PreviewCandidate["status"];
  decision: "import" | "skip";
  overrideReason?: string;
}

export interface CommitRequest {
  pack: any;
  embeddingModel: string;
  questions: Array<any & CommitDecision>;
}

export async function postCommit(body: CommitRequest) {
  const { post } = getFetchClient();
  const { data } = await post("/question-import/commit", body);
  return data;
}
```

- [ ] **Step 3: Write draft store**

Create `apps/backend/src/plugins/question-import/admin/src/lib/draftStore.ts`:

```ts
import { get, set, del, keys } from "idb-keyval";
import type { PreviewRequest, PreviewResponse } from "./api";

const PREFIX = "question-import-draft:";

export interface Draft {
  previewId: string;
  createdAt: number;
  request: PreviewRequest;
  response: PreviewResponse;
}

export async function saveDraft(draft: Draft): Promise<void> {
  await set(PREFIX + draft.previewId, draft);
}

export async function loadDraft(previewId: string): Promise<Draft | undefined> {
  return get(PREFIX + previewId);
}

export async function deleteDraft(previewId: string): Promise<void> {
  await del(PREFIX + previewId);
}

export async function listDrafts(): Promise<Draft[]> {
  const all = await keys();
  const out: Draft[] = [];
  for (const k of all) {
    if (typeof k === "string" && k.startsWith(PREFIX)) {
      const d = await get<Draft>(k);
      if (d) out.push(d);
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/package.json bun.lock apps/backend/src/plugins/question-import/admin/src/lib/
git commit -m "feat(question-import): admin API client + IndexedDB draft store"
```

---

## Task 14: Admin — SimilarityBar & ConflictCard

**Files:**
- Create: `apps/backend/src/plugins/question-import/admin/src/components/SimilarityBar.tsx`
- Create: `apps/backend/src/plugins/question-import/admin/src/components/ConflictCard.tsx`

- [ ] **Step 1: SimilarityBar**

Create `apps/backend/src/plugins/question-import/admin/src/components/SimilarityBar.tsx`:

```tsx
import { Box, Typography } from "@strapi/design-system";

interface Props {
  similarity: number; // 0..1
}

function color(sim: number): string {
  if (sim >= 0.92) return "#d32f2f";
  if (sim >= 0.85) return "#f9a825";
  return "#2e7d32";
}

export function SimilarityBar({ similarity }: Props) {
  const pct = Math.round(similarity * 100);
  return (
    <Box>
      <Box
        background="neutral200"
        style={{ height: 8, borderRadius: 4, overflow: "hidden", width: 180 }}
      >
        <Box
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color(similarity),
          }}
        />
      </Box>
      <Typography variant="pi">{pct}% similarité</Typography>
    </Box>
  );
}
```

- [ ] **Step 2: ConflictCard**

Create `apps/backend/src/plugins/question-import/admin/src/components/ConflictCard.tsx`:

```tsx
import { Box, Typography, Badge } from "@strapi/design-system";
import { SimilarityBar } from "./SimilarityBar";
import type { PreviewCandidate } from "../lib/api";

interface Props {
  match: PreviewCandidate["matches"][number];
}

export function ConflictCard({ match }: Props) {
  return (
    <Box
      padding={3}
      marginBottom={2}
      background="neutral100"
      hasRadius
      shadow="filterShadow"
    >
      <Box paddingBottom={2}>
        <Typography variant="omega" fontWeight="bold">
          {match.text}
        </Typography>
      </Box>
      <Box paddingBottom={2}>
        <Typography variant="pi" textColor="neutral600">
          Pack: {match.packSlug} · Catégorie: {match.categoryName}
        </Typography>
      </Box>
      <Box paddingBottom={2}>
        <SimilarityBar similarity={match.similarity} />
      </Box>
      {match.sameAnswer && (
        <Badge backgroundColor="warning200" textColor="warning700">
          Même réponse normalisée
        </Badge>
      )}
    </Box>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/plugins/question-import/admin/src/components/
git commit -m "feat(question-import): add SimilarityBar and ConflictCard components"
```

---

## Task 15: Admin — Upload Page

**Files:**
- Modify: `apps/backend/src/plugins/question-import/admin/src/pages/Upload.tsx`

- [ ] **Step 1: Replace the placeholder with functional upload page**

Replace `apps/backend/src/plugins/question-import/admin/src/pages/Upload.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Textarea,
  Typography,
  Alert,
} from "@strapi/design-system";
import { postPreview } from "../lib/api";
import { saveDraft } from "../lib/draftStore";

export default function Upload() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      const body = JSON.parse(raw);
      const response = await postPreview(body);
      await saveDraft({
        previewId: response.previewId,
        createdAt: Date.now(),
        request: body,
        response,
      });
      navigate(`../review/${response.previewId}`);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box padding={8}>
      <Typography variant="alpha" tag="h1">
        Importer un pack de questions
      </Typography>
      <Box paddingTop={4} paddingBottom={4}>
        <Typography variant="omega" textColor="neutral600">
          Colle un JSON au format <code>{`{ pack, questions[] }`}</code>. Les
          doublons seront détectés avant l'enregistrement définitif.
        </Typography>
      </Box>
      {error && (
        <Box paddingBottom={4}>
          <Alert variant="danger" title="Erreur">
            {error}
          </Alert>
        </Box>
      )}
      <Textarea
        label="JSON"
        placeholder='{"pack":{...},"questions":[...]}'
        rows={16}
        value={raw}
        onChange={(e: any) => setRaw(e.target.value)}
      />
      <Box paddingTop={4}>
        <Button loading={busy} onClick={handleSubmit} disabled={!raw.trim()}>
          Analyser
        </Button>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/plugins/question-import/admin/src/pages/Upload.tsx
git commit -m "feat(question-import): add admin Upload page"
```

---

## Task 16: Admin — Review Page

**Files:**
- Create: `apps/backend/src/plugins/question-import/admin/src/pages/Review.tsx`
- Modify: `apps/backend/src/plugins/question-import/admin/src/index.ts` — register `/review/:previewId` route

- [ ] **Step 1: Create Review page**

Create `apps/backend/src/plugins/question-import/admin/src/pages/Review.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Checkbox,
  Typography,
  Textarea,
  Alert,
  Badge,
} from "@strapi/design-system";
import { loadDraft, deleteDraft, type Draft } from "../lib/draftStore";
import { postCommit, type PreviewCandidate } from "../lib/api";
import { ConflictCard } from "../components/ConflictCard";

type DecisionMap = Record<number, { include: boolean; overrideReason: string }>;

export default function Review() {
  const { previewId } = useParams<{ previewId: string }>();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewId) return;
    loadDraft(previewId).then((d) => {
      if (!d) return;
      setDraft(d);
      const init: DecisionMap = {};
      for (const c of d.response.candidates) {
        init[c.index] = {
          include:
            c.status === "clean" || c.status === "needs_review",
          overrideReason: "",
        };
      }
      setDecisions(init);
    });
  }, [previewId]);

  if (!draft) {
    return (
      <Box padding={8}>
        <Alert variant="warning" title="Draft introuvable">
          Ce draft n'est plus disponible localement.
        </Alert>
      </Box>
    );
  }

  function toggle(index: number) {
    setDecisions((d) => ({
      ...d,
      [index]: { ...d[index], include: !d[index].include },
    }));
  }

  function setReason(index: number, reason: string) {
    setDecisions((d) => ({
      ...d,
      [index]: { ...d[index], overrideReason: reason },
    }));
  }

  async function handleCommit() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const requestQuestions = draft.request.questions;
      const questions = draft.response.candidates.map((c) => {
        const src = requestQuestions[c.index];
        const dec = decisions[c.index];
        return {
          ...src,
          embedding: c.embedding,
          normalizedAnswer: c.normalizedAnswer,
          status: c.status,
          decision: dec.include ? "import" : "skip",
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

  const groups: Record<PreviewCandidate["status"], PreviewCandidate[]> = {
    clean: [],
    needs_review: [],
    auto_blocked: [],
    intra_batch_duplicate: [],
  };
  for (const c of draft.response.candidates) {
    groups[c.status].push(c);
  }

  return (
    <Box padding={8}>
      <Typography variant="alpha" tag="h1">
        Review de l'import {draft.previewId.slice(0, 8)}
      </Typography>
      {error && (
        <Box paddingTop={4}>
          <Alert variant="danger" title="Erreur">
            {error}
          </Alert>
        </Box>
      )}
      <Box paddingTop={6}>
        <SectionTitle label="Propres" count={groups.clean.length} color="success" />
        {groups.clean.map((c) => (
          <CandidateRow
            key={c.index}
            candidate={c}
            request={draft.request.questions[c.index]}
            decision={decisions[c.index]}
            onToggle={toggle}
            onReasonChange={setReason}
          />
        ))}
      </Box>
      <Box paddingTop={6}>
        <SectionTitle
          label="À reviewer"
          count={groups.needs_review.length}
          color="warning"
        />
        {groups.needs_review.map((c) => (
          <CandidateRow
            key={c.index}
            candidate={c}
            request={draft.request.questions[c.index]}
            decision={decisions[c.index]}
            onToggle={toggle}
            onReasonChange={setReason}
          />
        ))}
      </Box>
      <Box paddingTop={6}>
        <SectionTitle
          label="Bloqués auto"
          count={groups.auto_blocked.length}
          color="danger"
        />
        {groups.auto_blocked.map((c) => (
          <CandidateRow
            key={c.index}
            candidate={c}
            request={draft.request.questions[c.index]}
            decision={decisions[c.index]}
            onToggle={toggle}
            onReasonChange={setReason}
            requireReason
          />
        ))}
      </Box>
      <Box paddingTop={6}>
        <SectionTitle
          label="Doublons intra-batch"
          count={groups.intra_batch_duplicate.length}
          color="warning"
        />
        {groups.intra_batch_duplicate.map((c) => (
          <CandidateRow
            key={c.index}
            candidate={c}
            request={draft.request.questions[c.index]}
            decision={decisions[c.index]}
            onToggle={toggle}
            onReasonChange={setReason}
          />
        ))}
      </Box>
      <Box paddingTop={8}>
        <Button loading={busy} onClick={handleCommit}>
          Commit
        </Button>
      </Box>
    </Box>
  );
}

function SectionTitle({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "success" | "warning" | "danger";
}) {
  return (
    <Box paddingBottom={3}>
      <Typography variant="beta">
        {label} <Badge>{count}</Badge>
      </Typography>
    </Box>
  );
}

function CandidateRow({
  candidate,
  request,
  decision,
  onToggle,
  onReasonChange,
  requireReason,
}: {
  candidate: PreviewCandidate;
  request: any;
  decision: { include: boolean; overrideReason: string };
  onToggle: (i: number) => void;
  onReasonChange: (i: number, r: string) => void;
  requireReason?: boolean;
}) {
  return (
    <Box
      padding={3}
      marginBottom={3}
      background="neutral0"
      shadow="tableShadow"
      hasRadius
    >
      <Box paddingBottom={2}>
        <Checkbox
          value={decision?.include ?? false}
          onValueChange={() => onToggle(candidate.index)}
        >
          <Typography variant="omega" fontWeight="bold">
            {candidate.question}
          </Typography>
        </Checkbox>
      </Box>
      <Box paddingBottom={2}>
        <Typography variant="pi" textColor="neutral600">
          Réponse: {request.answer} · Catégorie: {request.category}
        </Typography>
      </Box>
      {candidate.matches.filter((m) => m.similarity >= 0.85).map((m) => (
        <ConflictCard key={m.questionId} match={m} />
      ))}
      {requireReason && decision?.include && (
        <Box paddingTop={2}>
          <Textarea
            label="Raison de l'override"
            placeholder="Pourquoi importer malgré le doublon ?"
            rows={2}
            value={decision.overrideReason}
            onChange={(e: any) => onReasonChange(candidate.index, e.target.value)}
          />
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Register route in admin index**

Replace `apps/backend/src/plugins/question-import/admin/src/index.ts`:

```ts
export default {
  register(app: any) {
    app.addMenuLink({
      to: "/plugins/question-import",
      icon: () => null,
      intlLabel: {
        id: "question-import.plugin.name",
        defaultMessage: "Question Import",
      },
      Component: async () => import("./App"),
      permissions: [],
    });
  },
  bootstrap() {},
};
```

- [ ] **Step 3: App router file**

Create `apps/backend/src/plugins/question-import/admin/src/App.tsx`:

```tsx
import { Routes, Route } from "react-router-dom";
import Upload from "./pages/Upload";
import Review from "./pages/Review";

export default function App() {
  return (
    <Routes>
      <Route index element={<Upload />} />
      <Route path="review/:previewId" element={<Review />} />
    </Routes>
  );
}
```

- [ ] **Step 4: Manual test**

```bash
cd apps/backend && bun run strapi develop
```

Visit `http://localhost:1337/admin/plugins/question-import`. Paste sample JSON → Analyser → Review page loads with grouped candidates. Click Commit → redirects back, data in DB.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/plugins/question-import/admin/src/
git commit -m "feat(question-import): add admin Review page with grouped statuses"
```

---

## Task 17: Backfill Script

**Files:**
- Create: `apps/backend/scripts/backfill-embeddings.ts`

- [ ] **Step 1: Write the script**

Create `apps/backend/scripts/backfill-embeddings.ts`:

```ts
import { createRequire } from "node:module";
import OpenAI from "openai";
import pgvector from "pgvector/utils";
import { normalizeAnswer } from "../src/plugins/question-import/server/services/normalize";

const BATCH_SIZE = 100;
const MODEL = "text-embedding-3-small";

async function main() {
  const require = createRequire(import.meta.url);
  const { Client } = require("pg") as typeof import("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY missing");
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey });

  const total = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM questions WHERE embedding IS NULL OR embedding_model IS DISTINCT FROM $1`,
    [MODEL],
  );
  const totalCount = Number(total.rows[0].count);
  console.log(`Backfilling ${totalCount} question(s)...`);

  let done = 0;
  while (true) {
    const res = await client.query<{ id: number; text: string; answer: string }>(
      `SELECT id, text, answer FROM questions
       WHERE embedding IS NULL OR embedding_model IS DISTINCT FROM $1
       ORDER BY id
       LIMIT $2`,
      [MODEL, BATCH_SIZE],
    );
    if (res.rows.length === 0) break;

    const texts = res.rows.map((r) => r.text);
    const resp = await openai.embeddings.create({ model: MODEL, input: texts });

    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows[i];
      const vec = resp.data[i].embedding;
      await client.query(
        `UPDATE questions
         SET embedding = $1::vector,
             embedding_model = $2,
             normalized_answer = $3
         WHERE id = $4`,
        [pgvector.toSql(vec), MODEL, normalizeAnswer(row.answer), row.id],
      );
    }
    done += res.rows.length;
    console.log(`${done}/${totalCount}`);
  }

  await client.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Dry run on empty/seed DB**

Seed a few questions first (if the seed script creates some), then:

```bash
cd apps/backend
bun run scripts/backfill-embeddings.ts
```

Expected: prints `Backfilling N question(s)...`, shows progress, ends `Done.`

- [ ] **Step 3: Verify embeddings populated**

```bash
docker exec quiz-app-postgres psql -U strapi -d quiz -c "SELECT COUNT(*) FROM questions WHERE embedding IS NULL;"
```

Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/scripts/backfill-embeddings.ts
git commit -m "feat(backend): add embedding backfill script for existing questions"
```

---

## Task 18: End-to-End Smoke Test

**Files:**
- Create: `apps/backend/tests/question-import/e2e.smoke.test.ts` (optional, time-boxed)

- [ ] **Step 1: Write an end-to-end-ish test that hits the HTTP API locally**

Create `apps/backend/tests/question-import/e2e.smoke.test.ts`:

```ts
import { test, expect, describe } from "bun:test";

const BASE = process.env.STRAPI_URL ?? "http://localhost:1337";
const TOKEN = process.env.STRAPI_ADMIN_JWT;

const maybe = TOKEN ? describe : describe.skip;

maybe("question-import e2e", () => {
  test("preview returns candidates", async () => {
    const res = await fetch(`${BASE}/question-import/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        pack: { slug: "smoke-test", name: "Smoke" },
        questions: [
          {
            category: "Smoke",
            type: "qcm",
            question: "Smoke test question ?",
            choices: ["a", "b", "c", "d"],
            answer: "a",
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates.length).toBe(1);
    expect(body.candidates[0].status).toBe("clean");
  });
});
```

- [ ] **Step 2: Document how to run locally**

In `apps/backend/README.md`, add a section (or create one) explaining:
```
# Run smoke test (requires Strapi running + admin JWT)
STRAPI_ADMIN_JWT=<token> bun test tests/question-import/e2e.smoke.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/tests/question-import/e2e.smoke.test.ts apps/backend/README.md
git commit -m "test(question-import): add optional e2e smoke test"
```

---

## Task 19: Final Validation

- [ ] **Step 1: Run full test suite**

```bash
cd apps/backend
bun test
```

Expected: all tests pass (~35+ tests).

- [ ] **Step 2: Type-check**

```bash
cd apps/backend
bun run check-types
```

Expected: no errors.

- [ ] **Step 3: Manual end-to-end**

1. `bun run up`
2. `cd apps/backend && bun run strapi develop`
3. Visit admin → Question Import → paste 3 questions with 1 duplicate of a seeded question → Analyser
4. Verify review page groups correctly: 1 `auto_blocked`, others `clean`
5. Commit with override → verify DB has new rows with embeddings

- [ ] **Step 4: Close-out commit**

```bash
git commit --allow-empty -m "feat(question-import): complete feature, all tests green"
```
