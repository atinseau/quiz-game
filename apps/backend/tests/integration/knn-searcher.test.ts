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
