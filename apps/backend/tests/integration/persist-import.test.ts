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
