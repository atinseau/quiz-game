import { Client } from "pg";
import OpenAI from "openai";
import pgvector from "pgvector/utils";
import { normalizeAnswer } from "../src/plugins/question-import/server/services/normalize";

const MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

interface QuestionRow {
  id: number;
  text: string;
  answer: string | null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "" || value.includes("your-openai-key-here")) {
    throw new Error(`Missing or placeholder env var: ${name}`);
  }
  return value;
}

async function connectPg(): Promise<Client> {
  const connectionString = requireEnv("DATABASE_URL");
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

const PENDING_WHERE =
  "embedding IS NULL OR embedding_model IS DISTINCT FROM $1";

async function countPending(client: Client): Promise<number> {
  const res = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM questions WHERE ${PENDING_WHERE}`,
    [MODEL],
  );
  return Number(res.rows[0]?.count ?? 0);
}

async function fetchBatch(
  client: Client,
  limit: number,
): Promise<QuestionRow[]> {
  const res = await client.query<QuestionRow>(
    `SELECT id, text, answer
       FROM questions
      WHERE ${PENDING_WHERE}
      ORDER BY id ASC
      LIMIT $2`,
    [MODEL, limit],
  );
  return res.rows;
}

async function embedBatch(
  openai: OpenAI,
  texts: string[],
): Promise<number[][]> {
  const resp = await openai.embeddings.create({ model: MODEL, input: texts });
  return resp.data.map((d) => d.embedding);
}

async function updateRow(
  client: Client,
  row: QuestionRow,
  vec: number[],
): Promise<void> {
  await client.query(
    `UPDATE questions
        SET embedding = $1::vector,
            embedding_model = $2,
            normalized_answer = $3
      WHERE id = $4`,
    [pgvector.toSql(vec), MODEL, normalizeAnswer(row.answer ?? ""), row.id],
  );
}

async function processBatch(
  client: Client,
  openai: OpenAI,
  rows: QuestionRow[],
): Promise<void> {
  const vectors = await embedBatch(
    openai,
    rows.map((r) => r.text ?? ""),
  );
  for (let i = 0; i < rows.length; i++) {
    await updateRow(client, rows[i], vectors[i]);
  }
}

async function main(): Promise<void> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const openai = new OpenAI({ apiKey });
  const client = await connectPg();

  try {
    const total = await countPending(client);
    if (total === 0) {
      console.log("Nothing to backfill — all questions are up to date.");
      return;
    }
    console.log(`Backfilling ${total} question(s) with model ${MODEL}...`);

    let processed = 0;
    while (true) {
      const rows = await fetchBatch(client, BATCH_SIZE);
      if (rows.length === 0) break;
      await processBatch(client, openai, rows);
      processed += rows.length;
      console.log(`${processed}/${total}`);
    }
    console.log("Done.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
