import { v4 as uuid } from "uuid";
import pgvector from "pgvector/utils";
import type { EmbeddingService } from "./embeddings";
import { normalizeAnswer } from "./normalize";
import {
  classifyCandidate,
  detectIntraBatchDuplicates,
  type ClassifiedCandidate,
} from "./analyzer";

export interface ImportPack {
  slug?: string;
  name?: string;
  description?: string;
  icon?: string;
  gradient?: string;
}

export interface ImportQuestion {
  category?: string;
  type?: string;
  question?: string;
  choices?: unknown;
  answer?: string;
}

export interface ImportBody {
  pack?: ImportPack;
  questions?: ImportQuestion[];
}

export interface PreviewCandidate {
  index: number;
  question: string;
  normalizedAnswer: string;
  embedding: number[];
  status: ClassifiedCandidate["status"];
  matches: ClassifiedCandidate["matches"];
}

export interface PreviewResult {
  previewId: string;
  embeddingModel: string;
  candidates: PreviewCandidate[];
}

const VALID_TYPES = ["qcm", "vrai_faux", "texte"] as const;

export function validateImportBody(body: ImportBody): string[] {
  const errors: string[] = [];
  if (!body.pack) return ["pack is required"];
  if (!body.pack.slug || typeof body.pack.slug !== "string" || body.pack.slug.trim() === "") {
    errors.push("pack.slug is required");
  }
  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    errors.push("questions must be a non-empty array");
    return errors;
  }
  for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i];
    const p = `questions[${i}]`;
    if (!q.category) errors.push(`${p}.category is required`);
    if (!q.type || !VALID_TYPES.includes(q.type as (typeof VALID_TYPES)[number])) {
      errors.push(`${p}.type invalid`);
    }
    if (!q.question) errors.push(`${p}.question is required`);
    if (!q.answer) errors.push(`${p}.answer is required`);
    if (q.type === "qcm") {
      if (
        !Array.isArray(q.choices) ||
        q.choices.length !== 4 ||
        !q.choices.every((c: unknown) => typeof c === "string")
      ) {
        errors.push(`${p}.choices must be exactly 4 strings for qcm`);
      }
    }
    if (q.type === "vrai_faux" && q.answer !== "true" && q.answer !== "false") {
      errors.push(`${p}.answer must be "true" or "false" for vrai_faux`);
    }
  }
  return errors;
}

export interface KnnSearchInput {
  embedding: number[];
  limit: number;
}

export interface KnnRow {
  questionId: number;
  text: string;
  packSlug: string;
  categoryName: string;
  similarity: number;
  normalizedAnswer: string;
}

export interface KnnSearcher {
  search(input: KnnSearchInput): Promise<KnnRow[]>;
}

export interface PreviewDeps {
  embeddings: EmbeddingService;
  knn: KnnSearcher;
  model: string;
}

export async function runPreview(
  body: ImportBody,
  deps: PreviewDeps,
): Promise<PreviewResult> {
  const errors = validateImportBody(body);
  if (errors.length > 0) {
    const err = new Error("Validation failed") as Error & { details?: string[] };
    err.details = errors;
    throw err;
  }
  const questions = body.questions as ImportQuestion[];

  const texts = questions.map((q) => q.question as string);
  const embeddings = await deps.embeddings.embedBatch(texts);

  const normalized = questions.map((q) => normalizeAnswer(q.answer as string));

  const intraBatchDuplicates = detectIntraBatchDuplicates(
    embeddings.map((e, i) => ({ embedding: e, normalizedAnswer: normalized[i] })),
  );

  const candidates: PreviewCandidate[] = [];
  for (let i = 0; i < questions.length; i++) {
    const existing = await deps.knn.search({ embedding: embeddings[i], limit: 10 });
    const classified = classifyCandidate(
      { normalizedAnswer: normalized[i] },
      existing,
    );

    const status = intraBatchDuplicates.has(i)
      ? "intra_batch_duplicate"
      : classified.status;

    candidates.push({
      index: i,
      question: questions[i].question as string,
      normalizedAnswer: normalized[i],
      embedding: embeddings[i],
      status,
      matches: classified.matches,
    });
  }

  return {
    previewId: uuid(),
    embeddingModel: deps.model,
    candidates,
  };
}

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

export type QuestionDecision = "import" | "skip";

export interface CommitQuestion {
  category?: string;
  type?: string;
  question?: string;
  choices?: unknown;
  answer?: string;
  decision: QuestionDecision;
  overrideReason?: string;
}

export interface CommitBody {
  pack: ImportPack & { slug: string };
  embeddingModel: string;
  questions: CommitQuestion[];
}

export interface CommitSummary {
  pack: { slug: string; status: "created" | "existing" };
  categories: Array<{ name: string; status: "created" | "existing" }>;
  questions: { created: number; skipped: number; total: number };
}

export interface CommitDeps {
  strapi: any;
  embeddings: EmbeddingService;
  knn: KnnSearcher;
}

export function validateCommitBody(body: CommitBody): string[] {
  const errors: string[] = [];
  if (!body.pack?.slug) errors.push("pack.slug required");
  if (!body.embeddingModel) errors.push("embeddingModel required");
  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    errors.push("questions must be non-empty");
    return errors;
  }
  for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i];
    const p = `questions[${i}]`;
    if (!["import", "skip"].includes(q.decision as any)) {
      errors.push(`${p}.decision must be import|skip`);
    }
    if (!q.question || typeof q.question !== "string") {
      errors.push(`${p}.question is required`);
    }
    if (!q.answer || typeof q.answer !== "string") {
      errors.push(`${p}.answer is required`);
    }
    if (!q.category || typeof q.category !== "string") {
      errors.push(`${p}.category is required`);
    }
    if (!q.type || !["qcm", "vrai_faux", "texte"].includes(q.type as any)) {
      errors.push(`${p}.type invalid`);
    }
  }
  return errors;
}

export interface ClientCommitQuestion {
  category?: string;
  type?: string;
  question?: string;
  choices?: unknown;
  answer?: string;
  decision: "import" | "skip";
  overrideReason?: string;
}

export interface ReclassifyDeps {
  embeddings: EmbeddingService;
  knn: KnnSearcher;
}

export interface ReclassifiedQuestion {
  source: ClientCommitQuestion;
  embedding: number[];
  normalizedAnswer: string;
  status: ClassifiedCandidate["status"];
  matches: ClassifiedCandidate["matches"];
  requiresOverrideReason: boolean;
}

export async function reclassifyForCommit(args: {
  questions: ClientCommitQuestion[];
  embeddings: EmbeddingService;
  knn: KnnSearcher;
}): Promise<ReclassifiedQuestion[]> {
  const texts = args.questions.map((q) => (q.question as string) ?? "");
  const embeddingVecs = await args.embeddings.embedBatch(texts);
  const normalized = args.questions.map((q) => normalizeAnswer((q.answer as string) ?? ""));

  const intraDup = detectIntraBatchDuplicates(
    embeddingVecs.map((e, i) => ({
      embedding: e,
      normalizedAnswer: normalized[i],
    })),
  );

  const out: ReclassifiedQuestion[] = [];
  for (let i = 0; i < args.questions.length; i++) {
    const matches = await args.knn.search({ embedding: embeddingVecs[i], limit: 10 });
    const classified = classifyCandidate(
      { normalizedAnswer: normalized[i] },
      matches,
    );
    const status = intraDup.has(i) ? "intra_batch_duplicate" : classified.status;
    const requiresOverrideReason =
      (status === "auto_blocked" || status === "intra_batch_duplicate") &&
      args.questions[i].decision === "import";
    out.push({
      source: args.questions[i],
      embedding: embeddingVecs[i],
      normalizedAnswer: normalized[i],
      status,
      matches: classified.matches,
      requiresOverrideReason,
    });
  }
  return out;
}

export async function runCommit(
  body: CommitBody,
  deps: CommitDeps,
): Promise<CommitSummary> {
  const errors = validateCommitBody(body);
  if (errors.length > 0) {
    const err = new Error("Validation failed") as Error & { details?: string[] };
    err.details = errors;
    throw err;
  }

  const reclassified = await reclassifyForCommit({
    questions: body.questions,
    embeddings: deps.embeddings,
    knn: deps.knn,
  });

  const overrideErrors: string[] = [];
  for (let i = 0; i < reclassified.length; i++) {
    const r = reclassified[i];
    if (
      r.requiresOverrideReason &&
      (!r.source.overrideReason || r.source.overrideReason.trim() === "")
    ) {
      overrideErrors.push(
        `questions[${i}].overrideReason required for server-computed status "${r.status}"`,
      );
    }
  }
  if (overrideErrors.length > 0) {
    const err = new Error("Override required") as Error & { details?: string[] };
    err.details = overrideErrors;
    throw err;
  }

  const toImport = reclassified
    .filter((r) => r.source.decision === "import")
    .map((r) => ({
      category: r.source.category as string,
      type: r.source.type as "qcm" | "vrai_faux" | "texte",
      text: r.source.question as string,
      choices: r.source.choices,
      answer: r.source.answer as string,
      embedding: r.embedding,
      normalizedAnswer: r.normalizedAnswer,
    }));

  const { persistImport } = await import("./persistImport");
  const result = await persistImport(deps.strapi.db.connection, {
    pack: body.pack,
    embeddingModel: body.embeddingModel,
    questions: toImport,
  });

  return {
    pack: result.pack,
    categories: result.categories,
    questions: {
      created: result.questions.created,
      skipped: body.questions.length - result.questions.created,
      total: body.questions.length,
    },
  };
}
