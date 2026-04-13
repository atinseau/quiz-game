import {
  detectQuestionType,
  expect,
  nextQuestion,
  setupGame,
  test,
} from "../helpers/fixtures";

test.describe("All question types display correctly", () => {
  test("QCM, Vrai/Faux, and Texte inputs all work", async ({
    mockApp: page,
  }) => {
    await setupGame(page, { players: ["Alice"], mode: "Classique" });

    const seenTypes = new Set<string>();

    for (let i = 0; i < 6; i++) {
      const type = await detectQuestionType(page);
      seenTypes.add(type);

      if (type === "qcm") {
        // Should have multiple choice buttons in a grid
        const choices = page.locator(".grid button");
        const count = await choices.count();
        expect(count).toBeGreaterThanOrEqual(2);

        // Click first choice
        await choices.first().click();

        // All choices should be disabled after answering
        for (let j = 0; j < count; j++) {
          await expect(choices.nth(j)).toBeDisabled();
        }
      } else if (type === "vrai_faux") {
        // Should have Vrai and Faux buttons
        await expect(page.getByRole("button", { name: "Vrai" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Faux" })).toBeVisible();

        await page.getByRole("button", { name: "Vrai" }).click();

        // Both disabled after answer
        await expect(page.getByRole("button", { name: "Vrai" })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Faux" })).toBeDisabled();
      } else {
        // Texte — should have text input and Valider button
        const input = page.getByPlaceholder("Votre reponse...");
        await expect(input).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Valider" }),
        ).toBeVisible();

        await input.fill("test answer");
        await input.press("Enter");

        // Input disabled after answer
        await expect(input).toBeDisabled();
      }

      // Feedback should appear after every answer
      await expect(
        page
          .locator("div")
          .filter({ hasText: /Correct|Mauvaise/ })
          .first(),
      ).toBeVisible();

      if (i < 5) await nextQuestion(page);
    }

    // Verify all 3 question types were seen (mock data has 2 of each)
    expect(seenTypes.has("qcm")).toBe(true);
    expect(seenTypes.has("vrai_faux")).toBe(true);
    expect(seenTypes.has("texte")).toBe(true);
  });

  test("text input clears between questions", async ({ mockApp: page }) => {
    await setupGame(page, { players: ["Alice"], mode: "Classique" });

    // Find and answer a text question, then check the next text question is cleared
    let answeredText = false;

    for (let i = 0; i < 6; i++) {
      const type = await detectQuestionType(page);

      if (type === "texte" && answeredText) {
        // This is the second text question — input should be empty
        const input = page.getByPlaceholder("Votre reponse...");
        await expect(input).toHaveValue("");
        return; // Test passed
      }

      if (type === "texte" && !answeredText) {
        const input = page.getByPlaceholder("Votre reponse...");
        await input.fill("some answer");
        await input.press("Enter");
        answeredText = true;
      } else if (type === "vrai_faux") {
        await page.getByRole("button", { name: "Vrai" }).click();
      } else {
        await page.locator(".grid button").first().click();
      }

      if (i < 5) await nextQuestion(page);
    }
  });
});
