import type { Knex } from "knex";
import pgvector from "pgvector/utils";
import type { KnnRow, KnnSearcher } from "./types";

interface RawKnnRow {
  questionId: number;
  text: string;
  packSlug: string;
  categoryName: string;
  similarity: string | number;
  normalizedAnswer: string;
}

export function createKnnSearcher(knex: Knex): KnnSearcher {
  return {
    async search({ embedding, limit }) {
      const vec = pgvector.toSql(embedding);
      const rows = await knex.raw<{ rows: RawKnnRow[] }>(
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
      return rows.rows.map<KnnRow>((r) => ({
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
