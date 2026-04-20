/**
 * Shared helpers for alcohol mode (special rounds) E2E tests.
 *
 * Layered on top of `fixtures.ts` (solo) and `multi-fixtures.ts` (multi).
 * Provides strict overlay waits, full-setup shortcuts, and typed round IDs.
 *
 * Usage (solo):
 *   import { test, expect, startSoloAlcoholGame, waitForRoundOverlay } from "../helpers/alcohol-fixtures";
 *   test("...", async ({ mockApp: page }) => {
 *     await startSoloAlcoholGame(page, {
 *       players: ["Alice", "Bob"],
 *       mode: "Classique",
 *       frequency: 3,
 *       enabledRounds: ["conseil"],
 *     });
 *     await playTurnsSolo(page, 3);
 *     await waitForRoundOverlay(page, "conseil");
 *   });
 *
 * Usage (multi): see startMultiAlcoholGame + waitForRoundOverlayAnyPlayer.
 */

import type { Page } from "@playwright/test";
import {
  addPlayers,
  answerCorrectly,
  answerIncorrectly,
  goToModeSelection,
  nextQuestion,
  selectPack,
} from "./fixtures";
import {
  answerViaUI,
  guestJoinsRoom,
  hostCreatesRoom,
  hostSelectsMode,
  hostSelectsPack,
  setTestUser,
} from "./multi-fixtures";

// Re-export so tests only need one import
export {
  expect,
  test as soloTest,
} from "./fixtures";
export { test as multiTest } from "./multi-fixtures";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type SpecialRoundId =
  | "petit_buveur"
  | "distributeur"
  | "courage"
  | "conseil"
  | "love_or_drink"
  | "cupidon"
  | "show_us"
  | "smatch_or_pass";

export interface AlcoholTestConfig {
  frequency: number;
  enabledRounds: SpecialRoundId[];
  culSecEndGame?: boolean;
}

/**
 * Visible labels for each special round overlay.
 * Use strict text match (exact title) instead of loose regex to avoid
 * false positives (e.g. `/conseil|vote/i` matching other texts).
 */
export const ROUND_TITLES: Record<SpecialRoundId, string> = {
  petit_buveur: "Petit buveur !",
  distributeur: "Distributeur !",
  courage: "Question de courage !",
  conseil: "Conseil du village",
  love_or_drink: "Love or Drink !",
  cupidon: "Cupidon a frappé !",
  show_us: "Show Us !",
  smatch_or_pass: "Smatch or Pass !",
};

/**
 * Labels used on the AlcoholConfig UI checkboxes (solo mode).
 * Used to toggle rounds off when configuring.
 */
export const ROUND_CONFIG_LABELS: Record<SpecialRoundId, string> = {
  petit_buveur: "Petit buveur",
  distributeur: "Distributeur",
  courage: "Question de courage",
  conseil: "Conseil du village",
  love_or_drink: "Love or Drink",
  cupidon: "Cupidon",
  show_us: "Show Us",
  smatch_or_pass: "Smatch or Pass",
};

const ALL_ROUND_IDS: SpecialRoundId[] = [
  "petit_buveur",
  "distributeur",
  "courage",
  "conseil",
  "love_or_drink",
  "cupidon",
  "show_us",
  "smatch_or_pass",
];

// ---------------------------------------------------------------------------
// Solo setup
// ---------------------------------------------------------------------------

/**
 * Configure alcohol mode on the mode selection screen (solo).
 * Assumes the page is on step 3 (mode selection) with the alcohol toggle visible.
 *
 * Steps:
 * 1. Enable alcohol mode (click "Désactivé")
 * 2. Set frequency
 * 3. Uncheck rounds not in enabledRounds
 */
export async function configureSoloAlcohol(
  page: Page,
  config: AlcoholTestConfig,
): Promise<void> {
  // Enable alcohol mode (toggle says "Désactivé" → click to enable)
  await page.getByRole("button", { name: "Désactivé" }).click();

  // Frequency — button with the numeric value
  await page
    .getByRole("button", { name: String(config.frequency), exact: true })
    .click();

  // All rounds enabled by default in solo alcoholStore
  // Toggle OFF rounds not in enabledRounds
  for (const id of ALL_ROUND_IDS) {
    if (!config.enabledRounds.includes(id)) {
      const label = ROUND_CONFIG_LABELS[id];
      await page.getByText(label, { exact: true }).first().click();
    }
  }
}

/**
 * Full solo setup: select pack → add players → go to mode selection → configure
 * alcohol → start the requested mode. Ends with page on `/game`.
 */
export async function startSoloAlcoholGame(
  page: Page,
  opts: {
    players: string[];
    mode: "Classique" | "Voleur" | "Contre la montre";
    pack?: string;
  } & AlcoholTestConfig,
): Promise<void> {
  await page.goto("/play/solo");
  await selectPack(page, opts.pack ?? "Pack Test");
  await addPlayers(page, opts.players);
  await goToModeSelection(page);

  await configureSoloAlcohol(page, {
    frequency: opts.frequency,
    enabledRounds: opts.enabledRounds,
    culSecEndGame: opts.culSecEndGame,
  });

  await page.getByRole("button", { name: new RegExp(opts.mode) }).click();
  await page.waitForURL("**/game");
}

/**
 * Play N turns in solo mode, answering each question.
 * Stops early if a special round overlay appears.
 *
 * Returns the number of turns actually played before the overlay (if any).
 */
export async function playTurnsSolo(
  page: Page,
  turns: number,
): Promise<number> {
  for (let q = 0; q < turns; q++) {
    // Try correct answer first, fallback to incorrect
    try {
      await answerCorrectly(page);
    } catch {
      try {
        await answerIncorrectly(page);
      } catch {
        // Unknown question — click any available button as last resort
        const firstBtn = page.locator(".grid button").first();
        if (await firstBtn.isVisible().catch(() => false)) {
          await firstBtn.click();
        }
      }
    }

    await page.waitForTimeout(300);

    // If a special round overlay is already showing, stop here
    const overlayVisible = await hasAnyRoundOverlay(page);
    if (overlayVisible) return q + 1;

    // Otherwise click "Question suivante" if present
    const nextBtn = page.getByRole("button", { name: "Question suivante" });
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextQuestion(page);
    }
    await page.waitForTimeout(300);
  }
  return turns;
}

// ---------------------------------------------------------------------------
// Multi setup
// ---------------------------------------------------------------------------

/**
 * Send the start_game message with an alcohol config, bypassing the normal
 * UI (which doesn't expose alcohol controls to non-host test users).
 */
export async function sendStartGameWithAlcohol(
  host: Page,
  config: AlcoholTestConfig,
): Promise<void> {
  await host.evaluate((cfg) => {
    // biome-ignore lint/suspicious/noExplicitAny: test globals
    const activeWs = (window as any).__testActiveWs as WebSocket;
    if (activeWs?.readyState === WebSocket.OPEN) {
      // biome-ignore lint/suspicious/noExplicitAny: test globals
      const OrigWs = (window as any).__OriginalWebSocket;
      OrigWs.prototype.send.call(
        activeWs,
        JSON.stringify({
          type: "start_game",
          alcoholConfig: {
            enabled: true,
            frequency: cfg.frequency,
            enabledRounds: cfg.enabledRounds,
            culSecEndGame: cfg.culSecEndGame ?? false,
          },
        }),
      );
    }
  }, config);
}

/**
 * Update the current player's gender via WS.
 * Needed for `smatch_or_pass` (requires one homme + one femme).
 * Must be called while in lobby, before start_game.
 */
export async function setPlayerGender(
  page: Page,
  gender: "homme" | "femme",
): Promise<void> {
  await page.evaluate((g) => {
    // biome-ignore lint/suspicious/noExplicitAny: test globals
    const activeWs = (window as any).__testActiveWs as WebSocket;
    if (activeWs?.readyState === WebSocket.OPEN) {
      // biome-ignore lint/suspicious/noExplicitAny: test globals
      const OrigWs = (window as any).__OriginalWebSocket;
      OrigWs.prototype.send.call(
        activeWs,
        JSON.stringify({ type: "update_gender", gender: g }),
      );
    }
  }, gender);
  // Let the server broadcast player_updated back
  await page.waitForTimeout(300);
}

/**
 * Full multi setup: host creates room, guest joins, pack + mode selected,
 * game started with alcohol config. Ends with both pages on `/game`.
 *
 * If `genders` is provided, both players' gender is updated before start.
 */
export async function startMultiAlcoholGame(
  host: Page,
  guest: Page,
  opts: AlcoholTestConfig & {
    hostName?: string;
    guestName?: string;
    hostGender?: "homme" | "femme";
    guestGender?: "homme" | "femme";
    mode?: string;
    pack?: string;
  },
): Promise<{ code: string }> {
  const hostName = opts.hostName ?? "Alice";
  const guestName = opts.guestName ?? "Bob";

  await setTestUser(host, hostName);
  await setTestUser(guest, guestName);

  const code = await hostCreatesRoom(host);
  await guestJoinsRoom(guest, code);

  // Wait for guest to appear in host's lobby
  await host.getByText(guestName).waitFor({ timeout: 5000 });

  if (opts.hostGender) await setPlayerGender(host, opts.hostGender);
  if (opts.guestGender) await setPlayerGender(guest, opts.guestGender);

  await hostSelectsPack(host, opts.pack ?? "pack-test");
  await hostSelectsMode(host, opts.mode ?? "classic");
  await sendStartGameWithAlcohol(host, opts);

  await host.waitForURL("**/game", { timeout: 10000 });
  await guest.waitForURL("**/game", { timeout: 10000 });

  return { code };
}

/**
 * Play N turns in multi mode, answering on whoever is the active player.
 * Uses answerViaUI which tries QCM / VF / texte in order.
 */
export async function playTurnsMulti(
  host: Page,
  guest: Page,
  turns: number,
): Promise<number> {
  for (let q = 0; q < turns; q++) {
    if (host.url().includes("/end") || guest.url().includes("/end")) {
      return q;
    }
    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});

    let answered = false;
    for (const player of [host, guest]) {
      if (await answerViaUI(player)) {
        answered = true;
        break;
      }
    }
    if (!answered) {
      // Couldn't answer — check if a special round overlay is already up
      if (await hasAnyRoundOverlay(host)) return q;
      if (await hasAnyRoundOverlay(guest)) return q;
    }

    // 3s for turn_result + 1-2s margin for scheduleNextQuestion → checkTrigger
    await host.waitForTimeout(4000);

    // Early exit if special round started
    if ((await hasAnyRoundOverlay(host)) || (await hasAnyRoundOverlay(guest))) {
      return q + 1;
    }
  }
  return turns;
}

// ---------------------------------------------------------------------------
// Overlay waits & assertions
// ---------------------------------------------------------------------------

export class RoundOverlayTimeoutError extends Error {
  constructor(round: SpecialRoundId, timeoutMs: number) {
    super(
      `Timeout waiting for ${round} overlay (title="${ROUND_TITLES[round]}") after ${timeoutMs}ms`,
    );
    this.name = "RoundOverlayTimeoutError";
  }
}

/**
 * Wait for a specific special round overlay by its exact title text.
 * Throws RoundOverlayTimeoutError on timeout (instead of Playwright's generic error).
 */
export async function waitForRoundOverlay(
  page: Page,
  round: SpecialRoundId,
  timeoutMs = 15000,
): Promise<void> {
  const title = ROUND_TITLES[round];
  try {
    await page.getByText(title, { exact: true }).first().waitFor({
      timeout: timeoutMs,
      state: "visible",
    });
  } catch {
    throw new RoundOverlayTimeoutError(round, timeoutMs);
  }
}

/**
 * Wait for a specific round overlay on either player (multi).
 * Returns the page that showed the overlay first.
 */
export async function waitForRoundOverlayAnyPlayer(
  host: Page,
  guest: Page,
  round: SpecialRoundId,
  timeoutMs = 15000,
): Promise<Page> {
  const title = ROUND_TITLES[round];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const player of [host, guest]) {
      if (
        await player
          .getByText(title, { exact: true })
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        return player;
      }
    }
    await host.waitForTimeout(500);
  }
  throw new RoundOverlayTimeoutError(round, timeoutMs);
}

/** Return true if any of the 8 round overlays is currently visible. */
export async function hasAnyRoundOverlay(page: Page): Promise<boolean> {
  for (const id of ALL_ROUND_IDS) {
    const visible = await page
      .getByText(ROUND_TITLES[id], { exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) return true;
  }
  return false;
}

/**
 * DrinkAlert renders as `<button class="fixed inset-0 z-[100] ...">`. The
 * SpecialRoundOverlay wrapper is a `<div>` with the same fixed/inset-0 but
 * z-[90] — filtering on the `<button>` tag disambiguates them.
 */
const DRINK_ALERT_SELECTOR = "button.fixed.inset-0";

/**
 * Count the number of DrinkAlert fullscreen overlays currently mounted.
 */
export async function countDrinkAlerts(page: Page): Promise<number> {
  return await page.locator(DRINK_ALERT_SELECTOR).count();
}

/**
 * Get all visible drink alert messages (fullscreen overlays).
 */
export async function getDrinkAlertMessages(page: Page): Promise<string[]> {
  const alerts = page.locator(DRINK_ALERT_SELECTOR);
  const count = await alerts.count();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = (await alerts.nth(i).textContent()) ?? "";
    out.push(text.trim());
  }
  return out;
}

/**
 * Poll until one of the two pages shows the given text.
 * Use instead of `locator.or()` (which requires locators from the same page).
 * Throws if neither page shows the text within `timeoutMs`.
 */
export async function waitForTextAnyPlayer(
  host: Page,
  guest: Page,
  text: string | RegExp,
  timeoutMs = 10000,
): Promise<Page> {
  const matcher =
    typeof text === "string"
      ? (p: Page) => p.getByText(text, { exact: true }).first()
      : (p: Page) => p.getByText(text).first();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const player of [host, guest]) {
      if (
        await matcher(player)
          .isVisible()
          .catch(() => false)
      ) {
        return player;
      }
    }
    await host.waitForTimeout(200);
  }
  throw new Error(
    `Timeout waiting for text ${JSON.stringify(text)} on either player (${timeoutMs}ms)`,
  );
}

/**
 * Wait until the special round overlay disappears (round ended).
 * Useful to assert cleanup / transition to next question.
 */
export async function waitForRoundOverlayGone(
  page: Page,
  round: SpecialRoundId,
  timeoutMs = 10000,
): Promise<void> {
  await page
    .getByText(ROUND_TITLES[round], { exact: true })
    .first()
    .waitFor({ state: "hidden", timeout: timeoutMs });
}
