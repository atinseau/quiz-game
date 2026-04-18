import { test, expect, describe } from "bun:test";
import { classifyCandidate } from "../../src/plugins/question-import/server/services/analyzer";

type ExistingMatch = {
  questionId: number;
  text: string;
  packSlug: string;
  categoryName: string;
  similarity: number;
  normalizedAnswer: string;
};

describe("classifyCandidate", () => {
  const candidate = {
    normalizedAnswer: "paris",
  };

  test("no matches → clean", () => {
    const result = classifyCandidate(candidate, []);
    expect(result.status).toBe("clean");
  });

  test("match above 0.92 → auto_blocked (any answer)", () => {
    const matches: ExistingMatch[] = [
      {
        questionId: 1,
        text: "Capitale de la France ?",
        packSlug: "geo",
        categoryName: "Europe",
        similarity: 0.94,
        normalizedAnswer: "paris",
      },
    ];
    const result = classifyCandidate(candidate, matches);
    expect(result.status).toBe("auto_blocked");
  });

  test("match 0.88 same answer → needs_review", () => {
    const matches: ExistingMatch[] = [
      {
        questionId: 1,
        text: "Quelle ville est la capitale française ?",
        packSlug: "geo",
        categoryName: "Europe",
        similarity: 0.88,
        normalizedAnswer: "paris",
      },
    ];
    const result = classifyCandidate(candidate, matches);
    expect(result.status).toBe("needs_review");
  });

  test("match 0.88 different answer → clean", () => {
    const matches: ExistingMatch[] = [
      {
        questionId: 1,
        text: "Plus grande ville de France ?",
        packSlug: "geo",
        categoryName: "Europe",
        similarity: 0.88,
        normalizedAnswer: "lyon",
      },
    ];
    const result = classifyCandidate(candidate, matches);
    expect(result.status).toBe("clean");
  });

  test("match below 0.85 → clean even with same answer", () => {
    const matches: ExistingMatch[] = [
      {
        questionId: 1,
        text: "unrelated",
        packSlug: "x",
        categoryName: "y",
        similarity: 0.80,
        normalizedAnswer: "paris",
      },
    ];
    const result = classifyCandidate(candidate, matches);
    expect(result.status).toBe("clean");
  });

  test("worst status wins across multiple matches", () => {
    const matches: ExistingMatch[] = [
      { questionId: 1, text: "a", packSlug: "p", categoryName: "c", similarity: 0.70, normalizedAnswer: "other" },
      { questionId: 2, text: "b", packSlug: "p", categoryName: "c", similarity: 0.88, normalizedAnswer: "paris" },
      { questionId: 3, text: "c", packSlug: "p", categoryName: "c", similarity: 0.95, normalizedAnswer: "paris" },
    ];
    const result = classifyCandidate(candidate, matches);
    expect(result.status).toBe("auto_blocked");
  });

  test("returned sameAnswer flag reflects comparison", () => {
    const matches: ExistingMatch[] = [
      { questionId: 1, text: "t", packSlug: "p", categoryName: "c", similarity: 0.88, normalizedAnswer: "paris" },
      { questionId: 2, text: "t", packSlug: "p", categoryName: "c", similarity: 0.88, normalizedAnswer: "lyon" },
    ];
    const result = classifyCandidate(candidate, matches);
    expect(result.matches[0].sameAnswer).toBe(true);
    expect(result.matches[1].sameAnswer).toBe(false);
  });
});

import { detectIntraBatchDuplicates } from "../../src/plugins/question-import/server/services/analyzer";
import { mockEmbed, blendedEmbed } from "../mocks/openai-embeddings";

describe("detectIntraBatchDuplicates", () => {
  test("empty batch → empty set", () => {
    expect(detectIntraBatchDuplicates([]).size).toBe(0);
  });

  test("unique batch → empty set", () => {
    const items = [
      { embedding: mockEmbed("A"), normalizedAnswer: "x" },
      { embedding: mockEmbed("B"), normalizedAnswer: "y" },
    ];
    expect(detectIntraBatchDuplicates(items).size).toBe(0);
  });

  test("identical candidates → later one flagged", () => {
    const items = [
      { embedding: mockEmbed("same"), normalizedAnswer: "x" },
      { embedding: mockEmbed("same"), normalizedAnswer: "x" },
    ];
    const dup = detectIntraBatchDuplicates(items);
    expect(dup.has(0)).toBe(false);
    expect(dup.has(1)).toBe(true);
  });

  test("near-duplicate with same answer → later flagged", () => {
    const items = [
      { embedding: mockEmbed("base"), normalizedAnswer: "x" },
      { embedding: blendedEmbed("base", "other", 0.9), normalizedAnswer: "x" },
    ];
    const dup = detectIntraBatchDuplicates(items);
    expect(dup.has(1)).toBe(true);
  });

  test("near-duplicate with different answer → not flagged", () => {
    const items = [
      { embedding: mockEmbed("base"), normalizedAnswer: "x" },
      { embedding: blendedEmbed("base", "other", 0.67), normalizedAnswer: "y" },
    ];
    const dup = detectIntraBatchDuplicates(items);
    expect(dup.has(1)).toBe(false);
  });
});

describe("cosine similarity (internal)", () => {
  test("returns true cosine for unnormalized vectors", () => {
    // Scaled vector — dot product would misleadingly be large
    // Verify via intra-batch detection: two identical texts should still be duplicates
    // even if their embeddings get scaled weirdly.
    const a = [2, 0, 0];
    const b = [4, 0, 0];
    // dot=8, cosine=1
    const items = [
      { embedding: a, normalizedAnswer: "x" },
      { embedding: b, normalizedAnswer: "x" },
    ];
    const dup = detectIntraBatchDuplicates(items);
    expect(dup.has(1)).toBe(true);
  });

  test("different vectors below threshold are not duplicates", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0]; // orthogonal → cosine=0
    const items = [
      { embedding: a, normalizedAnswer: "x" },
      { embedding: b, normalizedAnswer: "x" },
    ];
    const dup = detectIntraBatchDuplicates(items);
    expect(dup.has(1)).toBe(false);
  });
});
