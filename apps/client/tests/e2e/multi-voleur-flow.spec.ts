import type { Page } from "@playwright/test";
import {
  answerViaUI,
  expect,
  guestJoinsRoom,
  hostCreatesRoom,
  hostSelectsMode,
  hostSelectsPack,
  hostStartsGame,
  setTestUser,
  submitAnswerViaWs,
  test,
} from "../helpers/multi-fixtures";

/** Correct answers keyed by question text (from questions-pack-test.json) */
const CORRECT_ANSWERS: Record<string, string | boolean> = {
  "Quelle est la capitale de la France ?": "Paris",
  "Le soleil se lève à l'ouest.": false,
  "Quel est le plus grand océan du monde ?": "Pacifique",
  "Combien de planètes dans le système solaire ?": "8",
  "L'eau bout à 100°C au niveau de la mer.": true,
  "Quel gaz les plantes absorbent-elles ?": "CO2",
};

/** Wrong answers keyed by question text */
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

/** Set up a 2-player voleur game and wait for first question */
async function setupVoleurGame(host: Page, guest: Page): Promise<string> {
  await setTestUser(host, "Alice");
  await setTestUser(guest, "Bob");

  const code = await hostCreatesRoom(host);
  await guestJoinsRoom(guest, code);
  await expect(host.getByText("Bob")).toBeVisible({ timeout: 5000 });

  await hostSelectsPack(host, "pack-test");
  await hostSelectsMode(host, "voleur");
  await hostStartsGame(host);

  await host.waitForURL("**/game", { timeout: 10000 });
  await guest.waitForURL("**/game", { timeout: 10000 });
  await expect(host.locator("p.text-xl")).toBeVisible({ timeout: 10000 });

  return code;
}

// ---------------------------------------------------------------------------

test("Multi-device voleur: both players answer and game completes", async ({
  multi,
}) => {
  test.slow();
  const { host, guest } = multi;

  await setupVoleurGame(host, guest);

  // Play through all questions
  for (let q = 0; q < 10; q++) {
    if (isAtEnd(host, guest)) break;
    if (await checkEndVisible(host, guest)) break;

    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});

    for (const player of [host, guest]) {
      await answerViaUI(player);
    }

    await host.waitForTimeout(5000);
  }

  let ended = false;
  for (let i = 0; i < 20; i++) {
    if (isAtEnd(host, guest) || (await checkEndVisible(host, guest))) {
      ended = true;
      break;
    }
    await host.waitForTimeout(1000);
  }

  expect(ended).toBe(true);
});

test("Multi-device voleur: shows turn indicator and stealer cue", async ({
  multi,
}) => {
  test.slow();
  const { host, guest } = multi;

  await setupVoleurGame(host, guest);

  const hostText = await host.locator(".mb-4 p").textContent();
  const guestText = await guest.locator(".mb-4 p").textContent();

  const texts = [hostText, guestText];
  expect(texts.some((t) => t?.includes("Réponds en premier"))).toBe(true);
  expect(texts.some((t) => t?.includes("Tente de voler"))).toBe(true);
});

test("Multi-device voleur: main correct ends turn immediately, inputs lock", async ({
  multi,
}) => {
  test.slow();
  const { host, guest } = multi;

  await setupVoleurGame(host, guest);

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
  test.slow();
  const { host, guest } = multi;

  await setupVoleurGame(host, guest);

  const [main, stealer] = await identifyRoles(host, guest);
  const questionText = await getQuestionText(main);
  const wrongAnswer = WRONG_ANSWERS[questionText];
  const correctAnswer = CORRECT_ANSWERS[questionText];

  // Main answers incorrectly — steal window opens
  // biome-ignore lint/style/noNonNullAssertion: test data guaranteed by answer maps
  await submitAnswerViaWs(main, wrongAnswer!);

  // Short wait for player_answered broadcast
  await main.waitForTimeout(500);

  // Stealer answers correctly — triggers steal
  // biome-ignore lint/style/noNonNullAssertion: test data guaranteed by answer maps
  await submitAnswerViaWs(stealer, correctAnswer!);

  // Stealer should see amber "Vol reussi" feedback
  await expect(stealer.getByText(/Vol reussi/)).toBeVisible({ timeout: 5000 });

  // Verify amber styling on stealer's feedback box
  const stealerFeedback = stealer.locator(".border-amber-500\\/30");
  await expect(stealerFeedback).toBeVisible({ timeout: 2000 });

  // Main should see amber "t'a vole la reponse" feedback
  await expect(main.getByText(/vole la reponse/)).toBeVisible({
    timeout: 5000,
  });
});
