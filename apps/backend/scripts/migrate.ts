import { readdir } from "node:fs/promises";
import path from "node:path";
import Knex from "knex";

type Direction = "up" | "down";

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "database", "migrations");
const STRAPI_MIGRATIONS_TABLE = "strapi_migrations";

function parseArgs(): Direction {
  const dir = process.argv[2];
  if (dir !== "up" && dir !== "down") {
    console.error("Usage: bun run scripts/migrate.ts <up|down>");
    process.exit(1);
  }
  return dir;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function ensureTableExists(knex: Knex.Knex): Promise<void> {
  // Strapi creates this table on boot. If the script runs against a fresh DB
  // before Strapi has booted once, create a compatible shape so both agree.
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS ${STRAPI_MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      time TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function listAppliedMigrations(knex: Knex.Knex): Promise<Set<string>> {
  const { rows } = await knex.raw<{ rows: { name: string }[] }>(
    `SELECT name FROM ${STRAPI_MIGRATIONS_TABLE}`,
  );
  return new Set(rows.map((r) => r.name));
}

async function listMigrationFiles(): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) =>
    /\.(js|ts)$/.test(f),
  );
  return files.sort();
}

async function runMigrationFile(
  knex: Knex.Knex,
  file: string,
  direction: Direction,
): Promise<void> {
  const mod = await import(path.join(MIGRATIONS_DIR, file));
  const fn = mod[direction] ?? mod.default?.[direction];
  if (typeof fn !== "function") {
    console.warn(`  skipped (no '${direction}' export)`);
    return;
  }
  await fn(knex);
}

async function markApplied(knex: Knex.Knex, name: string): Promise<void> {
  await knex.raw(
    `INSERT INTO ${STRAPI_MIGRATIONS_TABLE} (name, time) VALUES (?, NOW())`,
    [name],
  );
}

async function markReverted(knex: Knex.Knex, name: string): Promise<void> {
  await knex.raw(
    `DELETE FROM ${STRAPI_MIGRATIONS_TABLE} WHERE name = ?`,
    [name],
  );
}

async function runUp(knex: Knex.Knex): Promise<void> {
  const files = await listMigrationFiles();
  const applied = await listAppliedMigrations(knex);
  const pending = files.filter((f) => !applied.has(f));
  console.log(
    `${pending.length} pending / ${applied.size} already applied / ${files.length} total`,
  );
  for (const file of pending) {
    console.log(`→ ${file}`);
    await runMigrationFile(knex, file, "up");
    await markApplied(knex, file);
  }
}

async function runDown(knex: Knex.Knex): Promise<void> {
  const applied = await listAppliedMigrations(knex);
  const files = (await listMigrationFiles())
    .filter((f) => applied.has(f))
    .reverse();
  console.log(`${files.length} to revert`);
  for (const file of files) {
    console.log(`← ${file}`);
    await runMigrationFile(knex, file, "down");
    await markReverted(knex, file);
  }
}

async function main() {
  const direction = parseArgs();
  const knex = Knex({ client: "pg", connection: requireEnv("DATABASE_URL") });
  try {
    await ensureTableExists(knex);
    if (direction === "up") await runUp(knex);
    else await runDown(knex);
    console.log("Done.");
  } finally {
    await knex.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
