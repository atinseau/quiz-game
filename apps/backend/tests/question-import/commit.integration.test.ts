import { describe, expect, test } from "bun:test";
import { validateCommitBody } from "../../src/plugins/question-import/server/services/import";

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
        decision: "import",
      },
    ],
  };
  return { ...base, ...overrides };
}

describe("validateCommitBody", () => {
  test("valid body → no errors", () => {
    expect(validateCommitBody(baseBody())).toEqual([]);
  });

  test("missing pack.slug → error", () => {
    expect(validateCommitBody(baseBody({ pack: { name: "P" } }))).toContain(
      "pack.slug required",
    );
  });

  test("missing embeddingModel → error", () => {
    expect(validateCommitBody(baseBody({ embeddingModel: "" }))).toContain(
      "embeddingModel required",
    );
  });

  test("invalid decision → error", () => {
    const body = baseBody({
      questions: [{ ...baseBody().questions[0], decision: "bogus" }],
    });
    expect(validateCommitBody(body)[0]).toMatch(/decision/);
  });

  test("missing question text → error", () => {
    const body = baseBody({
      questions: [{ ...baseBody().questions[0], question: "" }],
    });
    expect(validateCommitBody(body)[0]).toMatch(/question/);
  });

  test("skip decision is valid", () => {
    const body = baseBody({
      questions: [{ ...baseBody().questions[0], decision: "skip" }],
    });
    expect(validateCommitBody(body)).toEqual([]);
  });
});
