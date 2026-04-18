import { classifyCandidate, detectIntraBatchDuplicates } from "./analyzer";
import type { EmbeddingService } from "./embeddings";
import { normalizeAnswer } from "./normalize";
import type {
  ClientCommitQuestion,
  CommitBody,
  CommitDeps,
  CommitSummary,
  KnnSearcher,
  ReclassifiedQuestion,
} from "./types";
import { validateCommitBody } from "./validation";

export async function reclassifyForCommit(args: {
  questions: ClientCommitQuestion[];
  embeddings: EmbeddingService;
  knn: KnnSearcher;
}): Promise<ReclassifiedQuestion[]> {
  const texts = args.questions.map((q) => (q.question as string) ?? "");
  const embeddingVecs = await args.embeddings.embedBatch(texts);
  const normalized = args.questions.map((q) =>
    normalizeAnswer((q.answer as string) ?? ""),
  );

  const intraDup = detectIntraBatchDuplicates(
    embeddingVecs.map((e, i) => ({
      embedding: e,
      normalizedAnswer: normalized[i],
    })),
  );

  const allMatches = await Promise.all(
    embeddingVecs.map((e) => args.knn.search({ embedding: e, limit: 10 })),
  );

  const out: ReclassifiedQuestion[] = [];
  for (let i = 0; i < args.questions.length; i++) {
    const matches = allMatches[i];
    const classified = classifyCandidate(
      { normalizedAnswer: normalized[i] },
      matches,
    );
    const status = intraDup.has(i)
      ? "intra_batch_duplicate"
      : classified.status;
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
    const err = new Error("Validation failed") as Error & {
      details?: string[];
    };
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
    const err = new Error("Override required") as Error & {
      details?: string[];
    };
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
