import { getFetchClient } from "@strapi/strapi/admin";

export interface PreviewRequest {
  pack: any;
  questions: any[];
}

export interface PreviewCandidate {
  index: number;
  question: string;
  normalizedAnswer: string;
  embedding: number[];
  status: "clean" | "needs_review" | "auto_blocked" | "intra_batch_duplicate";
  matches: Array<{
    questionId: number;
    text: string;
    packSlug: string;
    categoryName: string;
    similarity: number;
    sameAnswer: boolean;
  }>;
}

export interface PreviewResponse {
  previewId: string;
  embeddingModel: string;
  candidates: PreviewCandidate[];
}

export async function postPreview(
  body: PreviewRequest,
): Promise<PreviewResponse> {
  const { post } = getFetchClient();
  const { data } = await post("/question-import/preview", body);
  return data;
}

export interface CommitDecision {
  embedding: number[];
  normalizedAnswer: string;
  status: PreviewCandidate["status"];
  decision: "import" | "skip";
  overrideReason?: string;
}

export interface CommitRequest {
  pack: any;
  embeddingModel: string;
  questions: Array<Record<string, any> & CommitDecision>;
}

export async function postCommit(body: CommitRequest) {
  const { post } = getFetchClient();
  const { data } = await post("/question-import/commit", body);
  return data;
}
