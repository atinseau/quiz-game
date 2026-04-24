// See .discovery/scenarios/voleur-stealer-correct-first-instant.md
//
// Regression: when the stealer answers correctly BEFORE the main responder,
// the turn must resolve immediately as a successful steal ("c'est un vol").
// Previously, `resolveVoleur` bailed out at `if (!game.answers.has(mainPlayerId)) return;`
// so the stealer's correct answer was stored but ignored until the main responder
// answered. If the main responder answered correctly, the main won and the
// stealer's steal was silently dropped — defeating the whole point of voleur mode.
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

async function getQuestionText(page: Page): Promise<string> {
  return (await page.locator("p.text-xl").textContent()) ?? "";
}

async function identifyRoles(host: Page, guest: Page): Promise<[Page, Page]> {
  const hostText = (await host.locator(".mb-4 p").textContent()) ?? "";
  if (hostText.includes("Réponds en premier")) return [host, guest];
  return [guest, host];
}

test("Multi voleur: stealer correct FIRST ends turn immediately (steal confirmed, main did not answer)", async ({
  multi,
}) => {
  const { host, guest } = multi;

  await startMultiGame(multi, { mode: "voleur" });

  const [main, stealer] = await identifyRoles(host, guest);
  const questionText = await getQuestionText(main);
  const correctAnswer = CORRECT_ANSWERS[questionText];
  expect(correctAnswer).toBeDefined();

  // Stealer answers correctly BEFORE the main responder says anything.
  // biome-ignore lint/style/noNonNullAssertion: asserted above
  await submitAnswerViaWs(stealer, correctAnswer!);

  // Expected behaviour: the turn resolves immediately as a successful steal.
  // Stealer should see "Vol réussi" (amber feedback), main should see
  // "t'a volé la réponse" — both WITHOUT the main responder ever submitting.
  await expect(stealer.getByText(/Vol réussi/)).toBeVisible({ timeout: 5000 });
  await expect(main.getByText(/volé la réponse/)).toBeVisible({
    timeout: 5000,
  });
});
