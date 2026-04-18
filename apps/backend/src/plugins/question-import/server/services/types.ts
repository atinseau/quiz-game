import type { EmbeddingService } from "./embeddings";
import type { ClassifiedCandidate } from "./analyzer";

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
