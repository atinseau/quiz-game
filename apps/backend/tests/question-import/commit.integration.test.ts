import { test, expect, describe } from "bun:test";
import { validateCommitBody } from "../../src/plugins/question-import/server/services/import";

const vec = new Array(1536).fill(0);

function baseBody(overrides: any = {}) {
  const base = {
    pack: { slug: "p", name: "P" },
    embeddingModel: "text-embedding-3-small",
    questions: [
      {
        category: "C",
        type: "qcm",
        question: "Q",
        choices: ["a", "b", "c", "d"],
        answer: "a",
        embedding: vec,
        normalizedAnswer: "a",
        status: "clean",
        decision: "import",
      },
    ],
  };
  return { ...base, ...overrides };
}

describe("validateCommitBody", () => {
  test("valid body → no errors", () => {
    expect(validateCommitBody(baseBody() as any)).toEqual([]);
  });

  test("missing pack.slug → error", () => {
    const body = baseBody({ pack: { name: "P" } });
    expect(validateCommitBody(body as any)).toContain("pack.slug required");
  });

  test("auto_blocked override without reason → error", () => {
    const body = baseBody({
      questions: [
        {
          ...baseBody().questions[0],
          status: "auto_blocked",
          decision: "import",
          overrideReason: "",
        },
      ],
    });
    expect(validateCommitBody(body as any)[0]).toMatch(/overrideReason/);
  });

  test("auto_blocked override with reason → no error", () => {
    const body = baseBody({
      questions: [
        {
          ...baseBody().questions[0],
          status: "auto_blocked",
          decision: "import",
          overrideReason: "duplicate is intentional",
        },
      ],
    });
    expect(validateCommitBody(body as any)).toEqual([]);
  });

  test("wrong embedding dim → error", () => {
    const body = baseBody({
      questions: [{ ...baseBody().questions[0], embedding: [1, 2, 3] }],
    });
    expect(validateCommitBody(body as any)[0]).toMatch(/1536/);
  });

  test("skip decision doesn't require embedding", () => {
    const body = baseBody({
      questions: [
        {
          ...baseBody().questions[0],
          embedding: [],
          decision: "skip",
        },
      ],
    });
    expect(validateCommitBody(body as any)).toEqual([]);
  });
});
