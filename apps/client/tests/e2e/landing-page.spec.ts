import { expect, test } from "../helpers/fixtures";

test.describe("Landing page", () => {
  test("displays hero, pack preview, and game modes", async ({ page }) => {
    // Mock Strapi for pack preview
    await page.route("**/api/question-packs**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              documentId: "p1",
              slug: "pack-1",
              name: "Généraliste",
              description: "Desc",
              icon: "🧠",
              gradient: "from-indigo-600 to-purple-700",
              isFree: true,
              published: true,
              displayOrder: 0,
              questions: { count: 50 },
            },
            {
              documentId: "p2",
              slug: "pack-2",
              name: "Géographie",
              description: "Desc",
              icon: "🌍",
              gradient: "from-green-600 to-teal-700",
              isFree: true,
              published: true,
              displayOrder: 1,
              questions: { count: 30 },
            },
          ],
        }),
      }),
    );
    await page.route("**/clerk.*.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.route("**/.well-known/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );

    await page.goto("/");

    // Hero
    await expect(page.getByText("Quiz Party")).toBeVisible();
    await expect(page.getByText(/pimente tes soirées/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Jouer maintenant/ }),
    ).toBeVisible();

    // Pack preview
    await expect(page.getByText("Généraliste")).toBeVisible();
    await expect(page.getByText("Géographie")).toBeVisible();

    // Game modes
    await expect(page.getByText("Classique")).toBeVisible();
    await expect(page.getByText("Voleur")).toBeVisible();
    await expect(page.getByText("Contre la montre")).toBeVisible();
  });

  test("rules modal opens with tabs", async ({ page }) => {
    await page.route("**/api/question-packs**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"data":[]}',
      }),
    );
    await page.route("**/clerk.*.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.route("**/.well-known/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );

    await page.goto("/");

    await page.getByRole("button", { name: /règles/i }).click();

    // Modal opens with tabs
    await expect(page.getByText("Règles du jeu")).toBeVisible();
    await expect(page.getByRole("tab", { name: /Classique/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Voleur/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Chrono/ })).toBeVisible();

    // Classic tab content visible by default
    await expect(page.getByText(/Tour par tour/)).toBeVisible();

    // Switch to Voleur tab
    await page.getByRole("tab", { name: /Voleur/ }).click();
    await expect(page.getByText(/voler sa réponse/)).toBeVisible();

    // Switch to Chrono tab
    await page.getByRole("tab", { name: /Chrono/ }).click();
    await expect(page.getByText(/15 secondes/)).toBeVisible();
  });
});
