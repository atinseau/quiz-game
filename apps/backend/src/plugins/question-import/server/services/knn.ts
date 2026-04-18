import pgvector from "pgvector/utils";
import type { KnnSearcher } from "./types";

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
