import { test, expect, describe } from "bun:test";
import { normalizeAnswer } from "../../src/plugins/question-import/server/services/normalize";

describe("normalizeAnswer", () => {
  test("lowercases", () => {
    expect(normalizeAnswer("Paris")).toBe("paris");
  });

  test("trims whitespace", () => {
    expect(normalizeAnswer("  paris  ")).toBe("paris");
  });

  test("removes accents", () => {
    expect(normalizeAnswer("Montréal")).toBe("montreal");
    expect(normalizeAnswer("Évian")).toBe("evian");
  });

  test("collapses whitespace", () => {
    expect(normalizeAnswer("la   ville  de   paris")).toBe("la ville de paris");
  });

  test("handles vrai_faux values", () => {
    expect(normalizeAnswer("true")).toBe("true");
    expect(normalizeAnswer("false")).toBe("false");
  });

  test("handles empty string", () => {
    expect(normalizeAnswer("")).toBe("");
  });

  test("combines all rules", () => {
    expect(normalizeAnswer("  La Ville de Montréal  ")).toBe(
      "la ville de montreal",
    );
  });
});
