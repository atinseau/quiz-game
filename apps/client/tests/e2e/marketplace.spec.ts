import { expect, test } from "../helpers/fixtures";

test.describe("Marketplace — pack display", () => {
  test("free packs can be selected normally", async ({ mockApp: page }) => {
    await page.goto("/play/solo");

    // Pack Test is free — clickable, leads to player setup
    const packCard = page.getByRole("button", { name: /Pack Test/ }).first();
    await expect(packCard).toBeVisible();
    await packCard.click();
    await expect(page.getByPlaceholder("Nom du joueur")).toBeVisible();
  });

  test("premium pack shows lock and price badge", async ({ mockApp: page }) => {
    // Override packs mock with a premium pack
    await page.route("**/api/question-packs**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              documentId: "p1",
              slug: "pack-free",
              name: "Pack Gratuit",
              description: "Gratuit",
              icon: "🎁",
              gradient: "from-green-500 to-teal-600",
              isFree: true,
              published: true,
              displayOrder: 0,
              questions: { count: 10 },
              price: null,
            },
            {
              documentId: "p2",
              slug: "pack-premium",
              name: "Pack Premium",
              description: "Payant",
              icon: "💎",
              gradient: "from-amber-500 to-orange-600",
              isFree: false,
              published: true,
              displayOrder: 1,
              questions: { count: 20 },
              price: 2.99,
            },
          ],
        }),
      }),
    );

    // Mock no purchases
    await page.route("**/api/purchases/me**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      }),
    );

    await page.goto("/play/solo");

    // Premium pack should show price
    await expect(page.getByText("2.99€").first()).toBeVisible({
      timeout: 5000,
    });

    // Free pack should be visible
    await expect(page.getByText("Pack Gratuit").first()).toBeVisible();
  });

  test("landing page shows price on premium packs", async ({ page }) => {
    await page.route("**/api/question-packs**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              documentId: "p1",
              slug: "pack-premium",
              name: "Pack Premium",
              description: "Payant",
              icon: "💎",
              gradient: "from-amber-500 to-orange-600",
              isFree: false,
              published: true,
              displayOrder: 0,
              questions: { count: 20 },
              price: 4.99,
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

    await expect(page.getByText("4.99€")).toBeVisible({ timeout: 5000 });
  });
});
