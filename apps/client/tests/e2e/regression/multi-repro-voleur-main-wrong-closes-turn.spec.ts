// See .discovery/scenarios/voleur-main-wrong-closes-turn.md
//
// Regression: when the main responder answers incorrectly, the voleur turn
// closes immediately and no steal is possible anymore. Leaking "main was
// wrong" to stealers would hand them a free retry, defeating the "beat main
// to the answer" premise of the mode.
import type { Page } from "@playwright/test";
import {
  expect,
  startMultiGame,
  submitAnswerViaWs,
  test,
} from "../../helpers/multi-fixtures";

const CORRECT_ANSWERS: Record<string, string | boolean> = {
  "Quelle est la capitale de la France ?": "Paris",
  "Le soleil se lève à l'ouest.": false,
  "Quel est le plus grand océan du monde ?": "Pacifique",
  "Combien de planètes dans le système solaire ?": "8",
  "L'eau bout à 100°C au niveau de la mer.": true,
  "Quel gaz les plantes absorbent-elles ?": "CO2",
};

const WRONG_ANSWERS: Record<string, string | boolean> = {
  "Quelle est la capitale de la France ?": "Lyon",
  "Le soleil se lève à l'ouest.": true,
  "Quel est le plus grand océan du monde ?": "Atlantique",
  "Combien de planètes dans le système solaire ?": "7",
  "L'eau bout à 100°C au niveau de la mer.": false,
  "Quel gaz les plantes absorbent-elles ?": "Oxygène",
};

async function getQuestionText(page: Page): Promise<string> {
  return (await page.locator("p.text-xl").textContent()) ?? "";
}

async function identifyRoles(host: Page, guest: Page): Promise<[Page, Page]> {
  const hostText = (await host.locator(".mb-4 p").textContent()) ?? "";
  if (hostText.includes("Réponds en premier")) return [host, guest];
  return [guest, host];
}

test("Multi voleur: main wrong closes the turn — stealer can no longer steal", async ({
  multi,
}) => {
  const { host, guest } = multi;

  await startMultiGame(multi, { mode: "voleur" });

  const [main, stealer] = await identifyRoles(host, guest);
  const questionText = await getQuestionText(main);
  const wrongAnswer = WRONG_ANSWERS[questionText];
  const correctAnswer = CORRECT_ANSWERS[questionText];

  // Main answers wrong — turn should resolve immediately.
  // biome-ignore lint/style/noNonNullAssertion: test data guaranteed by answer maps
  await submitAnswerViaWs(main, wrongAnswer!);

  // Both players see the turn result (not a steal — just a wrong answer).
  await expect(
    main.getByText(/Mauvaise réponse|bien répondu|mal répondu/),
  ).toBeVisible({ timeout: 5000 });
  await expect(
    stealer.getByText(/Mauvaise réponse|bien répondu|mal répondu/),
  ).toBeVisible({ timeout: 5000 });

  // Stealer's attempt after the turn closed must be a no-op: no steal
  // feedback should appear.
  // biome-ignore lint/style/noNonNullAssertion: test data guaranteed by answer maps
  await submitAnswerViaWs(stealer, correctAnswer!);

  // Give the server a beat to (not) react.
  await stealer.waitForTimeout(500);
  await expect(stealer.getByText(/Vol réussi/)).not.toBeVisible();
  await expect(main.getByText(/volé la réponse/)).not.toBeVisible();
});
