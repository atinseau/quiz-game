import { v4 as uuid } from "uuid";
import { normalizeAnswer } from "./normalize";
import { classifyCandidate, detectIntraBatchDuplicates } from "./analyzer";
import { validateImportBody } from "./validation";
import type {
  ImportBody,
  ImportQuestion,
  PreviewCandidate,
  PreviewDeps,
  PreviewResult,
} from "./types";

export async function runPreview(
  body: ImportBody,
  deps: PreviewDeps,
): Promise<PreviewResult> {
  const errors = validateImportBody(body);
  if (errors.length > 0) {
    const err = new Error(
      `Validation failed: ${errors.join("; ")}`,
    ) as Error & { details?: string[] };
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

  const allExistingMatches = await Promise.all(
    embeddings.map((e) => deps.knn.search({ embedding: e, limit: 10 })),
  );

  const candidates: PreviewCandidate[] = [];
  for (let i = 0; i < questions.length; i++) {
    const existing = allExistingMatches[i];
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
