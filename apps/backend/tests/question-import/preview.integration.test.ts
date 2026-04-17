import { test, expect, describe } from "bun:test";
import {
  runPreview,
  type KnnSearcher,
  type KnnRow,
} from "../../src/plugins/question-import/server/services/import";
import { mockEmbed } from "../mocks/openai-embeddings";
import { createEmbeddingService } from "../../src/plugins/question-import/server/services/embeddings";

function fakeOpenAIClient() {
  return {
    embeddings: {
      create: async ({ input }: { input: string[] }) => ({
        data: input.map((t) => ({ embedding: mockEmbed(t) })),
      }),
    },
  };
}

function fakeKnn(rows: KnnRow[]): KnnSearcher {
  return { search: async () => rows };
}

const embeddings = createEmbeddingService({
  client: fakeOpenAIClient() as any,
  model: "test",
});

const samplePack = { slug: "geo-fr", name: "Géo France" };

function qcm(text: string, answer: string, category = "Europe") {
  return {
    category,
    type: "qcm",
    question: text,
    choices: ["A", "B", "C", "D"],
    answer,
  };
}

describe("runPreview", () => {
  test("marks all clean when no existing matches", async () => {
    const body = {
      pack: samplePack,
      questions: [qcm("Capitale de la France ?", "Paris")],
    };
    const result = await runPreview(body, {
      embeddings,
      knn: fakeKnn([]),
      model: "test",
    });
    expect(result.candidates[0].status).toBe("clean");
  });

  test("auto_blocked when KNN returns ≥ 0.92 similarity", async () => {
    const body = {
      pack: samplePack,
      questions: [qcm("Capitale de la France ?", "Paris")],
    };
    const row: KnnRow = {
      questionId: 42,
      text: "Capitale française ?",
      packSlug: "other",
      categoryName: "Europe",
      similarity: 0.95,
      normalizedAnswer: "paris",
    };
    const result = await runPreview(body, {
      embeddings,
      knn: fakeKnn([row]),
      model: "test",
    });
    expect(result.candidates[0].status).toBe("auto_blocked");
  });

  test("needs_review when similarity in 0.85-0.92 and same answer", async () => {
    const body = {
      pack: samplePack,
      questions: [qcm("Capitale de la France ?", "Paris")],
    };
    const row: KnnRow = {
      questionId: 42,
      text: "Quelle ville est la capitale française ?",
      packSlug: "other",
      categoryName: "Europe",
      similarity: 0.88,
      normalizedAnswer: "paris",
    };
    const result = await runPreview(body, {
      embeddings,
      knn: fakeKnn([row]),
      model: "test",
    });
    expect(result.candidates[0].status).toBe("needs_review");
  });

  test("clean when same similarity range but different answer", async () => {
    const body = {
      pack: samplePack,
      questions: [qcm("Capitale de la France ?", "Paris")],
    };
    const row: KnnRow = {
      questionId: 42,
      text: "Plus grande ville ?",
      packSlug: "other",
      categoryName: "Europe",
      similarity: 0.88,
      normalizedAnswer: "lyon",
    };
    const result = await runPreview(body, {
      embeddings,
      knn: fakeKnn([row]),
      model: "test",
    });
    expect(result.candidates[0].status).toBe("clean");
  });

  test("intra_batch_duplicate flagged on second identical question", async () => {
    const body = {
      pack: samplePack,
      questions: [
        qcm("Capitale de la France ?", "Paris"),
        qcm("Capitale de la France ?", "Paris"),
      ],
    };
    const result = await runPreview(body, {
      embeddings,
      knn: fakeKnn([]),
      model: "test",
    });
    expect(result.candidates[0].status).toBe("clean");
    expect(result.candidates[1].status).toBe("intra_batch_duplicate");
  });

  test("rejects invalid body with errors", async () => {
    const body = { pack: { slug: "" }, questions: [] };
    expect(
      runPreview(body, { embeddings, knn: fakeKnn([]), model: "test" }),
    ).rejects.toThrow("Validation failed");
  });
});
