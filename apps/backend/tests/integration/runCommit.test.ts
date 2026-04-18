import { test, expect, beforeAll, afterAll, beforeEach, describe } from "bun:test";
import pgvector from "pgvector/utils";
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
    const vec = pgvector.toSql(mockEmbed("Capitale du Japon ?"));
    await db.knex.raw(
      `INSERT INTO questions (document_id, type, text, answer, pack_id, normalized_answer, embedding, embedding_model)
       VALUES (:did, :type, :text, :ans, 1, :norm, CAST(:vec AS vector), :model)`,
      { did: "q1", type: "qcm", text: "Capitale du Japon ?", ans: "Tokyo", norm: "tokyo", vec, model: "test" },
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
    const vec = pgvector.toSql(mockEmbed("Exact match"));
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
