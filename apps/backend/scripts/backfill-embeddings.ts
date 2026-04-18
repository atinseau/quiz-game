/// <reference types="bun-types" />
import KnexCtor, { type Knex } from "knex";
import OpenAI from "openai";
import pgvector from "pgvector/utils";
import { requireEnv } from "../src/env";
import { normalizeAnswer } from "../src/plugins/question-import/server/services/normalize";

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 1_000;

interface QuestionRow {
  id: number;
  text: string | null;
  answer: string | null;
}

export interface Embedder {
  embeddings: {
    create(args: {
      model: string;
      input: string[];
    }): Promise<{ data: Array<{ embedding: number[] }> }>;
  };
}

export interface BackfillDeps {
  knex: Knex;
  embedder: Embedder;
  model?: string;
  batchSize?: number;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  log?: (msg: string) => void;
}

const PENDING_WHERE =
  "embedding IS NULL OR embedding_model IS DISTINCT FROM :model";

async function countPending(knex: Knex, model: string): Promise<number> {
  const { rows } = await knex.raw<{ rows: { count: string }[] }>(
    `SELECT COUNT(*)::text AS count FROM questions WHERE ${PENDING_WHERE}`,
    { model },
  );
  return Number(rows[0]?.count ?? 0);
}

async function fetchBatch(
  knex: Knex,
  model: string,
  limit: number,
): Promise<QuestionRow[]> {
  const { rows } = await knex.raw<{ rows: QuestionRow[] }>(
    `SELECT id, text, answer FROM questions
     WHERE ${PENDING_WHERE}
     ORDER BY id ASC
     LIMIT :limit`,
    { model, limit },
  );
  return rows;
}

function assertNonEmptyText(rows: QuestionRow[]): void {
  const bad = rows.filter((r) => !r.text || r.text.trim() === "");
  if (bad.length > 0) {
    const ids = bad.map((r) => r.id).join(", ");
    throw new Error(
      `Questions with null/empty text cannot be embedded: ${ids}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry<T>(
  fn: () => Promise<T>,
  attempts: number,
  baseDelayMs: number,
  log: (msg: string) => void,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const delay = baseDelayMs * 2 ** i;
        log(
          `retry ${i + 1}/${attempts - 1} after ${delay}ms: ${(err as Error).message}`,
        );
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

async function embedTexts(
  embedder: Embedder,
  model: string,
  texts: string[],
): Promise<number[][]> {
  const resp = await embedder.embeddings.create({ model, input: texts });
  return resp.data.map((d) => d.embedding);
}

async function updateBatch(
  knex: Knex,
  model: string,
  rows: QuestionRow[],
  vectors: number[][],
): Promise<void> {
  const ids = rows.map((r) => r.id);
  const embeddings = vectors.map((v) => pgvector.toSql(v));
  const normalized = rows.map((r) => normalizeAnswer(r.answer ?? ""));
  await knex.raw(
    `UPDATE questions AS q
     SET embedding = data.embedding::vector,
         embedding_model = :model,
         normalized_answer = data.normalized_answer
     FROM (
       SELECT UNNEST(:ids::int[]) AS id,
              UNNEST(:embeddings::text[]) AS embedding,
              UNNEST(:normalized::text[]) AS normalized_answer
     ) AS data
     WHERE q.id = data.id`,
    { model, ids, embeddings, normalized },
  );
}

export async function runBackfill(
  deps: BackfillDeps,
): Promise<{ processed: number }> {
  const model = deps.model ?? DEFAULT_MODEL;
  const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;
  const retryAttempts = deps.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
  const retryBaseDelayMs = deps.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const log = deps.log ?? ((m) => console.log(m));

  const total = await countPending(deps.knex, model);
  if (total === 0) {
    log("Nothing to backfill — all questions are up to date.");
    return { processed: 0 };
  }
  log(`Backfilling ${total} question(s) with model ${model}...`);

  let processed = 0;
  while (true) {
    const rows = await fetchBatch(deps.knex, model, batchSize);
    if (rows.length === 0) break;
    assertNonEmptyText(rows);

    const texts = rows.map((r) => r.text as string);
    const vectors = await retry(
      () => embedTexts(deps.embedder, model, texts),
      retryAttempts,
      retryBaseDelayMs,
      log,
    );
    await updateBatch(deps.knex, model, rows, vectors);
    processed += rows.length;
    log(`${processed}/${total}`);
  }
  log("Done.");
  return { processed };
}

async function main(): Promise<void> {
  const knex = KnexCtor({
    client: "pg",
    connection: requireEnv("DATABASE_URL"),
  });
  const embedder = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  try {
    await runBackfill({ knex, embedder });
  } finally {
    await knex.destroy();
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
