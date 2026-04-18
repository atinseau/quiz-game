import type { Knex } from "knex";

export async function up(knex: Knex) {
  await knex.raw("CREATE EXTENSION IF NOT EXISTS vector;");

  const hasEmbedding = await knex.schema.hasColumn("questions", "embedding");
  if (!hasEmbedding) {
    await knex.raw("ALTER TABLE questions ADD COLUMN embedding vector(1536);");
  }

  const hasModel = await knex.schema.hasColumn("questions", "embedding_model");
  if (!hasModel) {
    await knex.raw(
      "ALTER TABLE questions ADD COLUMN embedding_model varchar(64);",
    );
  }

  const hasNorm = await knex.schema.hasColumn("questions", "normalized_answer");
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

export async function down(knex: Knex) {
  await knex.raw("DROP INDEX IF EXISTS questions_normalized_answer;");
  await knex.raw("DROP INDEX IF EXISTS questions_embedding_hnsw;");
  await knex.raw(
    "ALTER TABLE questions DROP COLUMN IF EXISTS normalized_answer;",
  );
  await knex.raw(
    "ALTER TABLE questions DROP COLUMN IF EXISTS embedding_model;",
  );
  await knex.raw("ALTER TABLE questions DROP COLUMN IF EXISTS embedding;");
}
