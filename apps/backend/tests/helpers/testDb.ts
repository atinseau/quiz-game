import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import Knex, { type Knex as KnexType } from "knex";
import { Wait } from "testcontainers";

export interface TestDb {
  knex: KnexType;
  container: StartedPostgreSqlContainer;
  stop: () => Promise<void>;
  truncate: () => Promise<void>;
}

const PROJECT_BACKEND = path.resolve(__dirname, "..", "..");
const MIGRATIONS_DIR = path.join(PROJECT_BACKEND, "database", "migrations");

const BASE_SCHEMA_SQL = `
  CREATE TABLE question_packs (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    gradient VARCHAR(255),
    is_free BOOLEAN DEFAULT TRUE,
    stripe_price_id VARCHAR(255),
    price NUMERIC,
    published BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE categories_packs_lnk (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    pack_id INTEGER REFERENCES question_packs(id) ON DELETE CASCADE,
    category_ord DOUBLE PRECISION,
    pack_ord DOUBLE PRECISION
  );

  CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    type VARCHAR(32) NOT NULL,
    text TEXT NOT NULL,
    choices JSONB,
    answer VARCHAR(255) NOT NULL,
    display_order INTEGER DEFAULT 0,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    pack_id INTEGER REFERENCES question_packs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

async function applyOurMigration(knex: KnexType): Promise<void> {
  const files = await readdir(MIGRATIONS_DIR);
  const target = files.find((f) => f.includes("add-question-embeddings"));
  if (!target) {
    throw new Error("Could not locate add-question-embeddings migration file");
  }
  const mod = await import(path.join(MIGRATIONS_DIR, target));
  await mod.up(knex);
}

export async function startTestDb(): Promise<TestDb> {
  // Bun + node-docker-modem's stream handling doesn't finalize `docker exec` streams,
  // which causes `Wait.forListeningPorts()` (the default for PostgreSqlContainer) to
  // hang indefinitely after the health check already passes. Override with health-check
  // only, which is sufficient for Postgres readiness.
  const container = await new PostgreSqlContainer("pgvector/pgvector:pg16")
    .withDatabase("quiz_test")
    .withUsername("tester")
    .withPassword("tester")
    .withWaitStrategy(Wait.forHealthCheck())
    .start();

  const knex = Knex({
    client: "pg",
    connection: {
      host: container.getHost(),
      port: container.getPort(),
      user: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    },
    pool: { min: 1, max: 4 },
  });

  await knex.raw(BASE_SCHEMA_SQL);
  await applyOurMigration(knex);

  async function truncate() {
    await knex.raw(`
      TRUNCATE TABLE
        questions,
        categories_packs_lnk,
        categories,
        question_packs
      RESTART IDENTITY CASCADE;
    `);
  }

  async function stop() {
    await knex.destroy();
    await container.stop();
  }

  return { knex, container, stop, truncate };
}
