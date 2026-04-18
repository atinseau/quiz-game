import { test, expect, describe } from "bun:test";
import {
  reclassifyForCommit,
  type ClientCommitQuestion,
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

const embeddings = createEmbeddingService({
  client: fakeOpenAIClient() as any,
  model: "test",
});

function baseQ(overrides: Partial<ClientCommitQuestion> = {}): ClientCommitQuestion {
  return {
    category: "Cat",
    type: "qcm",
    question: "Q",
    choices: ["a", "b", "c", "d"],
    answer: "a",
    decision: "import",
    ...overrides,
  };
}

describe("reclassifyForCommit", () => {
  test("server re-embeds from question text (client embedding is ignored)", async () => {
    const result = await reclassifyForCommit({
      questions: [baseQ()],
      embeddings,
      knn: { search: async () => [] },
    });
    expect(result[0].embedding).toEqual(mockEmbed("Q"));
    expect(result[0].status).toBe("clean");
  });

  test("server overrides forged status", async () => {
    // Even if the client sent something misleading, the server recomputes
    const result = await reclassifyForCommit({
      questions: [baseQ({ question: "Q" })],
      embeddings,
      knn: {
        search: async () => [{
          questionId: 1,
          text: "existing",
          packSlug: "p",
          categoryName: "c",
          similarity: 0.95,
          normalizedAnswer: "a",
        }],
      },
    });
    expect(result[0].status).toBe("auto_blocked");
  });

  test("auto_blocked + decision=import + no override → validation error", async () => {
    const result = await reclassifyForCommit({
      questions: [baseQ({ question: "Q" })],
      embeddings,
      knn: {
        search: async () => [{
          questionId: 1,
          text: "existing",
          packSlug: "p",
          categoryName: "c",
          similarity: 0.95,
          normalizedAnswer: "a",
        }],
      },
    });
    expect(result[0].status).toBe("auto_blocked");
    expect(result[0].requiresOverrideReason).toBe(true);
  });

  test("intra_batch_duplicate on the server regardless of client status", async () => {
    const result = await reclassifyForCommit({
      questions: [baseQ({ question: "Duplicate" }), baseQ({ question: "Duplicate" })],
      embeddings,
      knn: { search: async () => [] },
    });
    expect(result[0].status).toBe("clean");
    expect(result[1].status).toBe("intra_batch_duplicate");
  });
});
