import { test, expect, describe } from "bun:test";

const BASE = process.env.STRAPI_URL ?? "http://localhost:1337";
const TOKEN = process.env.STRAPI_ADMIN_JWT;

const maybe = TOKEN ? describe : describe.skip;

maybe("question-import e2e (requires STRAPI_ADMIN_JWT)", () => {
  test("preview returns clean candidate for an isolated pack", async () => {
    const res = await fetch(`${BASE}/question-import/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        pack: { slug: "e2e-smoke", name: "E2E Smoke" },
        questions: [
          {
            category: "E2E",
            type: "qcm",
            question: "E2E smoke question ?",
            choices: ["a", "b", "c", "d"],
            answer: "a",
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { candidates: Array<{ status: string }> };
    expect(body.candidates.length).toBe(1);
    expect(body.candidates[0].status).toBe("clean");
  });
});
