import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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
    await db.knex.raw(
      `INSERT INTO questions (document_id, type, text, answer, pack_id, normalized_answer, embedding, embedding_model)
       VALUES ('q1', 'qcm', 'Q', 'A', 1, 'a', ?::vector, 'test-model')`,
      [JSON.stringify(Array(1536).fill(0.1))],
    );

    const rows = await db.knex.raw(`
      SELECT text, embedding_model FROM questions WHERE text = 'Q'
    `);
    expect(rows.rows[0].embedding_model).toBe("test-model");
  });
});
