import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { randomUUID } from "node:crypto";
import { type Embedder, runBackfill } from "../../scripts/backfill-embeddings";
import { startTestDb, type TestDb } from "../helpers/testDb";
import { mockEmbed } from "../mocks/openai-embeddings";

function fakeEmbedder(): Embedder {
  return {
    embeddings: {
      create: async ({ input }) => ({
        data: input.map((t) => ({ embedding: mockEmbed(t) })),
      }),
    },
  };
}

function flakyEmbedder(failuresBeforeSuccess: number): {
  embedder: Embedder;
  attempts: () => number;
} {
  let attempts = 0;
  const embedder: Embedder = {
    embeddings: {
      create: async ({ input }) => {
        attempts++;
        if (attempts <= failuresBeforeSuccess) {
          throw new Error(`simulated transient failure #${attempts}`);
        }
        return {
          data: input.map((t) => ({ embedding: mockEmbed(t) })),
        };
      },
    },
  };
  return { embedder, attempts: () => attempts };
}

describe("runBackfill (integration)", () => {
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

  async function seedPack(slug = "t"): Promise<number> {
    const { rows } = await db.knex.raw<{ rows: { id: number }[] }>(
      `INSERT INTO question_packs (document_id, slug, name) VALUES (?, ?, 'T') RETURNING id`,
      [randomUUID(), slug],
    );
    return rows[0].id;
  }

  async function seedQuestion(
    packId: number,
    text: string,
    answer: string,
  ): Promise<number> {
    const { rows } = await db.knex.raw<{ rows: { id: number }[] }>(
      `INSERT INTO questions (document_id, type, text, answer, pack_id, normalized_answer)
       VALUES (?, 'qcm', ?, ?, ?, '') RETURNING id`,
      [randomUUID(), text, answer, packId],
    );
    return rows[0].id;
  }

  test("populates embedding, embedding_model, normalized_answer on pending questions", async () => {
    const packId = await seedPack();
    await seedQuestion(packId, "Capitale de la France ?", "Paris");
    await seedQuestion(packId, "Fleuve traversant Paris ?", "Seine");

    const result = await runBackfill({
      knex: db.knex,
      embedder: fakeEmbedder(),
      batchSize: 10,
      log: () => {},
    });
    expect(result.processed).toBe(2);

    const { rows } = await db.knex.raw<{
      rows: {
        text: string;
        has_emb: boolean;
        embedding_model: string;
        normalized_answer: string;
      }[];
    }>(
      `SELECT text,
              embedding IS NOT NULL AS has_emb,
              embedding_model,
              normalized_answer
         FROM questions
         ORDER BY id ASC`,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].has_emb).toBe(true);
    expect(rows[0].embedding_model).toBe("text-embedding-3-small");
    expect(rows[0].normalized_answer).toBe("paris");
    expect(rows[1].normalized_answer).toBe("seine");
  });

  test("is idempotent — second run processes nothing", async () => {
    const packId = await seedPack();
    await seedQuestion(packId, "Q ?", "a");

    await runBackfill({
      knex: db.knex,
      embedder: fakeEmbedder(),
      log: () => {},
    });
    const second = await runBackfill({
      knex: db.knex,
      embedder: fakeEmbedder(),
      log: () => {},
    });
    expect(second.processed).toBe(0);
  });

  test("re-embeds rows whose embedding_model differs from target", async () => {
    const packId = await seedPack();
    const id = await seedQuestion(packId, "Q ?", "a");
    // Prime with a bogus model marker to simulate a model upgrade.
    await db.knex.raw(
      `UPDATE questions
         SET embedding = array_fill(0.0::real, ARRAY[1536])::vector,
             embedding_model = 'older-model'
       WHERE id = ?`,
      [id],
    );

    const result = await runBackfill({
      knex: db.knex,
      embedder: fakeEmbedder(),
      log: () => {},
    });
    expect(result.processed).toBe(1);

    const { rows } = await db.knex.raw<{
      rows: { embedding_model: string }[];
    }>(`SELECT embedding_model FROM questions WHERE id = ?`, [id]);
    expect(rows[0].embedding_model).toBe("text-embedding-3-small");
  });

  test("throws on questions with null/empty text", async () => {
    const packId = await seedPack();
    await db.knex.raw(
      `INSERT INTO questions (document_id, type, text, answer, pack_id, normalized_answer)
       VALUES (?, 'qcm', '', 'a', ?, '')`,
      [randomUUID(), packId],
    );

    await expect(
      runBackfill({
        knex: db.knex,
        embedder: fakeEmbedder(),
        log: () => {},
      }),
    ).rejects.toThrow(/null\/empty text/);
  });

  test("retries transient OpenAI failures with backoff", async () => {
    const packId = await seedPack();
    await seedQuestion(packId, "Q ?", "a");

    const { embedder, attempts } = flakyEmbedder(1);
    const result = await runBackfill({
      knex: db.knex,
      embedder,
      retryAttempts: 3,
      retryBaseDelayMs: 10,
      log: () => {},
    });
    expect(result.processed).toBe(1);
    expect(attempts()).toBe(2);
  });

  test("gives up after maxing out retries", async () => {
    const packId = await seedPack();
    await seedQuestion(packId, "Q ?", "a");

    const { embedder } = flakyEmbedder(10);
    await expect(
      runBackfill({
        knex: db.knex,
        embedder,
        retryAttempts: 2,
        retryBaseDelayMs: 10,
        log: () => {},
      }),
    ).rejects.toThrow(/transient failure/);
  });
});
