import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import pgvector from "pgvector/utils";

export interface PersistQuestion {
  category: string;
  type: "qcm" | "vrai_faux" | "texte";
  text: string;
  choices?: unknown;
  answer: string;
  embedding: number[];
  normalizedAnswer: string;
}

export interface PersistInput {
  pack: {
    slug: string;
    name?: string;
    description?: string;
    icon?: string;
    gradient?: string;
  };
  embeddingModel: string;
  questions: PersistQuestion[];
}

export interface PersistResult {
  pack: { slug: string; status: "created" | "existing" };
  categories: Array<{ name: string; status: "created" | "existing" }>;
  questions: { created: number; total: number };
}

function slugifyName(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function persistImport(
  knex: Knex,
  input: PersistInput,
): Promise<PersistResult> {
  return await knex.transaction(async (trx: Knex.Transaction) => {
    // 1. Upsert pack
    const packRows = await trx.raw(
      `SELECT id, document_id, slug FROM question_packs WHERE slug = ?`,
      [input.pack.slug],
    );

    let packId: number;
    let packDocumentId: string;
    let packStatus: "created" | "existing";
    if (packRows.rows.length > 0) {
      packId = packRows.rows[0].id;
      packDocumentId = packRows.rows[0].document_id;
      packStatus = "existing";
    } else {
      packDocumentId = randomUUID();
      const inserted = await trx.raw(
        `INSERT INTO question_packs
           (document_id, slug, name, description, icon, gradient, is_free)
         VALUES (?, ?, ?, ?, ?, ?, true)
         RETURNING id`,
        [
          packDocumentId,
          input.pack.slug,
          input.pack.name ?? input.pack.slug,
          input.pack.description ?? null,
          input.pack.icon ?? null,
          input.pack.gradient ?? null,
        ],
      );
      packId = inserted.rows[0].id;
      packStatus = "created";
    }

    // 2. Upsert categories + link
    const uniqueCategoryNames = [
      ...new Set(input.questions.map((q) => q.category)),
    ];
    const categorySummary: Array<{
      name: string;
      status: "created" | "existing";
    }> = [];
    const categoryIdByName = new Map<string, number>();

    for (const name of uniqueCategoryNames) {
      const existing = await trx.raw(
        `SELECT id, document_id FROM categories WHERE name = ? LIMIT 1`,
        [name],
      );
      let catId: number;
      let status: "created" | "existing";
      if (existing.rows.length > 0) {
        catId = existing.rows[0].id;
        status = "existing";
      } else {
        const inserted = await trx.raw(
          `INSERT INTO categories (document_id, name, slug) VALUES (?, ?, ?) RETURNING id`,
          [randomUUID(), name, slugifyName(name)],
        );
        catId = inserted.rows[0].id;
        status = "created";
      }

      const linkExists = await trx.raw(
        `SELECT 1 FROM categories_packs_lnk WHERE category_id = ? AND pack_id = ?`,
        [catId, packId],
      );
      if (linkExists.rows.length === 0) {
        await trx.raw(
          `INSERT INTO categories_packs_lnk (category_id, pack_id) VALUES (?, ?)`,
          [catId, packId],
        );
      }

      categoryIdByName.set(name, catId);
      categorySummary.push({ name, status });
    }

    // 3. Insert questions
    let created = 0;
    for (const q of input.questions) {
      const catId = categoryIdByName.get(q.category);
      await trx.raw(
        `INSERT INTO questions
           (document_id, type, text, choices, answer, category_id, pack_id,
            normalized_answer, embedding, embedding_model)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::vector, ?)`,
        [
          randomUUID(),
          q.type,
          q.text,
          q.type === "qcm" ? JSON.stringify(q.choices) : null,
          q.answer,
          catId ?? null,
          packId,
          q.normalizedAnswer,
          pgvector.toSql(q.embedding),
          input.embeddingModel,
        ],
      );
      created++;
    }

    return {
      pack: { slug: input.pack.slug, status: packStatus },
      categories: categorySummary,
      questions: { created, total: input.questions.length },
    };
  });
}
