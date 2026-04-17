export const THRESHOLD_BLOCK = 0.92;
export const THRESHOLD_REVIEW = 0.85;

export type CandidateStatus =
  | "clean"
  | "needs_review"
  | "auto_blocked"
  | "intra_batch_duplicate";

export interface CandidateInput {
  normalizedAnswer: string;
}

export interface ExistingMatch {
  questionId: number;
  text: string;
  packSlug: string;
  categoryName: string;
  similarity: number;
  normalizedAnswer: string;
}

export interface ClassifiedMatch extends ExistingMatch {
  sameAnswer: boolean;
}

export interface ClassifiedCandidate {
  status: CandidateStatus;
  matches: ClassifiedMatch[];
}

function severity(status: CandidateStatus): number {
  switch (status) {
    case "auto_blocked":
      return 3;
    case "intra_batch_duplicate":
      return 2;
    case "needs_review":
      return 1;
    case "clean":
      return 0;
  }
}

export function classifyCandidate(
  candidate: CandidateInput,
  matches: ExistingMatch[],
): ClassifiedCandidate {
  const classifiedMatches: ClassifiedMatch[] = matches.map((m) => ({
    ...m,
    sameAnswer: m.normalizedAnswer === candidate.normalizedAnswer,
  }));

  let status: CandidateStatus = "clean";

  for (const m of classifiedMatches) {
    let matchStatus: CandidateStatus = "clean";
    if (m.similarity >= THRESHOLD_BLOCK) {
      matchStatus = "auto_blocked";
    } else if (m.similarity >= THRESHOLD_REVIEW && m.sameAnswer) {
      matchStatus = "needs_review";
    }
    if (severity(matchStatus) > severity(status)) {
      status = matchStatus;
    }
  }

  return { status, matches: classifiedMatches };
}

export function detectIntraBatchDuplicates(
  candidates: Array<{ embedding: number[]; normalizedAnswer: string }>,
): Set<number> {
  const duplicates = new Set<number>();
  for (let i = 0; i < candidates.length; i++) {
    if (duplicates.has(i)) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      if (duplicates.has(j)) continue;
      const sim = cosine(candidates[i].embedding, candidates[j].embedding);
      const sameAns =
        candidates[i].normalizedAnswer === candidates[j].normalizedAnswer;
      if (sim >= THRESHOLD_BLOCK) {
        duplicates.add(j);
      } else if (sim >= THRESHOLD_REVIEW && sameAns) {
        duplicates.add(j);
      }
    }
  }
  return duplicates;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
