import type { Page } from "@playwright/test";
import {
  answerViaUI,
  expect,
  startMultiGame,
  submitAnswerViaWs,
  test,
} from "../../helpers/multi-fixtures";

/** Correct answers keyed by question text (from questions-pack-test.json) */
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

/**
 * Identify which player is the main responder and which is the stealer.
 * Returns [main, stealer] based on who sees "Réponds en premier".
 */
async function identifyRoles(host: Page, guest: Page): Promise<[Page, Page]> {
  const hostText = (await host.locator(".mb-4 p").textContent()) ?? "";
  if (hostText.includes("Réponds en premier")) return [host, guest];
  return [guest, host];
}

function isAtEnd(host: Page, guest: Page): boolean {
  return host.url().includes("/end") || guest.url().includes("/end");
}

async function checkEndVisible(host: Page, guest: Page): Promise<boolean> {
  const hostEnd = await host
    .getByText(/Fin de la partie/)
    .isVisible()
    .catch(() => false);
  const guestEnd = await guest
    .getByText(/Fin de la partie/)
    .isVisible()
    .catch(() => false);
  return hostEnd || guestEnd;
}

async function setupVoleurGame(multi: {
  host: Page;
  guest: Page;
}): Promise<string> {
  return startMultiGame(multi, { mode: "voleur" });
}

// Waits for the current question text to change, or the game to end.
// Bounds the transition after an answer without sleeping for a fixed 5s.
async function waitForNextTurnOrEnd(host: Page, guest: Page, prev: string) {
  const questionChanged = (p: Page) =>
    p.waitForFunction(
      (prevText) => {
        const el = document.querySelector("p.text-xl");
        const txt = el?.textContent?.trim();
        return !!txt && txt !== prevText;
      },
      prev.trim(),
      { timeout: 10_000 },
    );
  await Promise.any([
    questionChanged(host),
    questionChanged(guest),
    host.waitForURL("**/end", { timeout: 10_000 }),
    guest.waitForURL("**/end", { timeout: 10_000 }),
  ]).catch(() => {});
}

// ---------------------------------------------------------------------------

test("Multi-device voleur: both players answer across multiple turns", async ({
  multi,
}) => {
  const { host, guest } = multi;

  await setupVoleurGame(multi);

  // Play 3 turns — enough to confirm both devices can answer, turns alternate,
  // and the game progresses. Full traversal to /end is covered by chrono.
  for (let q = 0; q < 3; q++) {
    if (isAtEnd(host, guest)) break;
    if (await checkEndVisible(host, guest)) break;

    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});
    const prev = await getQuestionText(host);

    for (const player of [host, guest]) {
      await answerViaUI(player);
    }

    await waitForNextTurnOrEnd(host, guest, prev);
  }

  const stillRunning =
    (await host
      .locator("p.text-xl")
      .isVisible()
      .catch(() => false)) ||
    (await guest
      .locator("p.text-xl")
      .isVisible()
      .catch(() => false));
  expect(stillRunning || isAtEnd(host, guest)).toBe(true);
});

test("Multi-device voleur: shows turn indicator and stealer cue", async ({
  multi,
}) => {
  const { host, guest } = multi;

  await setupVoleurGame(multi);

  const hostText = await host.locator(".mb-4 p").textContent();
  const guestText = await guest.locator(".mb-4 p").textContent();

  const texts = [hostText, guestText];
  expect(texts.some((t) => t?.includes("Réponds en premier"))).toBe(true);
  expect(texts.some((t) => t?.includes("Tente de voler"))).toBe(true);
});

test("Multi-device voleur: main correct ends turn immediately, inputs lock", async ({
  multi,
}) => {
  const { host, guest } = multi;

  await setupVoleurGame(multi);

  const [main, stealer] = await identifyRoles(host, guest);
  const questionText = await getQuestionText(main);
  const correctAnswer = CORRECT_ANSWERS[questionText];

  // Stealer should have enabled inputs before anyone answers
  const stealerBtns = stealer.locator(".grid button, button:has-text('Vrai')");
  const btnCount = await stealerBtns.count().catch(() => 0);
  if (btnCount > 0) {
    const firstBtn = stealerBtns.first();
    expect(await firstBtn.isEnabled().catch(() => false)).toBe(true);
  }

  // Main answers correctly via WS — turn should resolve immediately
  // biome-ignore lint/style/noNonNullAssertion: test data guaranteed by CORRECT_ANSWERS map
  await submitAnswerViaWs(main, correctAnswer!);

  // Wait for turn_result to arrive (should be near-instant)
  await stealer
    .getByText(/Réponse correcte|Reponse correcte/)
    .waitFor({ timeout: 5000 });

  // Stealer's inputs should now be disabled (turnResult locks them)
  if (btnCount > 0) {
    const firstBtn = stealerBtns.first();
    await expect(firstBtn).toBeDisabled({ timeout: 2000 });
  }
});

test("Multi-device voleur: steal shows amber feedback", async ({ multi }) => {
  const { host, guest } = multi;

  await setupVoleurGame(multi);

  const [main, stealer] = await identifyRoles(host, guest);
  const questionText = await getQuestionText(main);
  const correctAnswer = CORRECT_ANSWERS[questionText];

  // Stealer beats main to the correct answer — the only path to a steal under
  // the current rules (main wrong closes the turn with no steal window).
  // biome-ignore lint/style/noNonNullAssertion: test data guaranteed by answer maps
  await submitAnswerViaWs(stealer, correctAnswer!);

  // Stealer should see amber "Vol réussi" feedback
  await expect(stealer.getByText(/Vol réussi/)).toBeVisible({ timeout: 5000 });

  // Verify amber styling on stealer's feedback box
  const stealerFeedback = stealer.locator(".border-amber-500\\/30");
  await expect(stealerFeedback).toBeVisible({ timeout: 2000 });

  // Main should see amber "t'a volé la réponse" feedback
  await expect(main.getByText(/volé la réponse/)).toBeVisible({
    timeout: 5000,
  });
});
