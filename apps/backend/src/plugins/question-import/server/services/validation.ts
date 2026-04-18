import type { CommitBody, ImportBody } from "./types";

export const VALID_TYPES = ["qcm", "vrai_faux", "texte"] as const;

export const MAX_QUESTIONS_PER_IMPORT = 500;

export function validateImportBody(body: ImportBody): string[] {
  const errors: string[] = [];
  if (!body.pack) return ["pack is required"];
  if (
    !body.pack.slug ||
    typeof body.pack.slug !== "string" ||
    body.pack.slug.trim() === ""
  ) {
    errors.push("pack.slug is required");
  }
  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    errors.push("questions must be a non-empty array");
    return errors;
  }
  if (body.questions.length > MAX_QUESTIONS_PER_IMPORT) {
    errors.push(
      `too many questions (${body.questions.length}); max ${MAX_QUESTIONS_PER_IMPORT}`,
    );
    return errors;
  }
  for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i];
    const p = `questions[${i}]`;
    if (!q.category) errors.push(`${p}.category is required`);
    if (
      !q.type ||
      !VALID_TYPES.includes(q.type as (typeof VALID_TYPES)[number])
    ) {
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
