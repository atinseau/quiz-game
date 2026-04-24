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
 * Visible labels for each special round overlay. Matched as substring (not
 * exact) so `petit_buveur` can point at the DrinkAlert message body — it's the
 * only round without a dedicated `<SpecialRoundOverlay>` card.
 */
export const ROUND_TITLES: Record<SpecialRoundId, string> = {
  petit_buveur: "une gorgée",
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

    // Wait for the answer to land: either "Question suivante" shows up,
    // or a special-round overlay takes over. Whichever happens first.
    const nextBtn = page.getByRole("button", { name: "Question suivante" });
    const overlay = anyRoundOverlayLocator(page);
    await Promise.any([
      nextBtn.waitFor({ state: "visible", timeout: 5000 }),
      overlay.waitFor({ state: "visible", timeout: 5000 }),
    ]).catch(() => {});

    if (await hasAnyRoundOverlay(page)) return q + 1;

    if (await nextBtn.isVisible().catch(() => false)) {
      // Capture the current question text so we can assert the transition
      // actually happened before looping to the next iteration.
      const prevQuestion =
        (await page
          .locator("p.text-xl")
          .textContent()
          .catch(() => "")) ?? "";
      await nextQuestion(page);

      // The next click triggers `gameStore.nextQuestion()` which calls
      // `checkTrigger`. We have to wait for ONE of:
      //  - a special-round overlay (trigger fired)
      //  - the question text to actually change (normal next question)
      // Waiting only for `nextBtn` to hide is not enough: Cupidon in solo
      // toggles nextBtn quickly but still needs time for the store update
      // to settle, and starting the next iteration too fast leaves
      // `turnsSinceLastSpecial` out of sync.
      await Promise.any([
        overlay.waitFor({ state: "visible", timeout: 5000 }),
        page.waitForFunction(
          (prev) => {
            const el = document.querySelector("p.text-xl");
            const txt = el?.textContent?.trim();
            return !!txt && txt !== prev;
          },
          prevQuestion.trim(),
          { timeout: 5000 },
        ),
      ]).catch(() => {});
    }
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
 *
 * Waits for the server's `player_updated` broadcast instead of a blind
 * sleep, so downstream `start_game` sees the new gender.
 */
export async function setPlayerGender(
  page: Page,
  gender: "homme" | "femme",
): Promise<void> {
  await page.evaluate(
    (g) =>
      new Promise<void>((resolve) => {
        // biome-ignore lint/suspicious/noExplicitAny: test globals
        const ws = (window as any).__testActiveWs as WebSocket | undefined;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          resolve();
          return;
        }
        const handler = (evt: MessageEvent) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.type === "player_updated" && data.gender === g) {
              ws.removeEventListener("message", handler);
              resolve();
            }
          } catch {}
        };
        ws.addEventListener("message", handler);
        // biome-ignore lint/suspicious/noExplicitAny: test globals
        const OrigWs = (window as any).__OriginalWebSocket;
        OrigWs.prototype.send.call(
          ws,
          JSON.stringify({ type: "update_gender", gender: g }),
        );
        // Safety net in case the broadcast is missed (e.g. server error).
        setTimeout(() => {
          ws.removeEventListener("message", handler);
          resolve();
        }, 1500);
      }),
    gender,
  );
}

/**
 * Default display names for players 3+ when `extraPages` is provided and
 * no `extraNames` override is given.
 */
const DEFAULT_EXTRA_NAMES = ["Carol", "Dave", "Eve", "Frank", "Grace", "Heidi"];

/**
 * Full multi setup: host creates room, guest joins, pack + mode selected,
 * game started with alcohol config. Ends with both pages on `/game`.
 *
 * If `genders` is provided, both players' gender is updated before start.
 *
 * `extraPages` lets tests run with 3+ players: each extra page joins the
 * same room, shows up in the host's lobby, and lands on `/game` when the
 * game starts. Backwards compatible — omit the option for 2-player specs.
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
    extraPages?: Page[];
    extraNames?: string[];
  },
): Promise<{ code: string }> {
  const hostName = opts.hostName ?? "Alice";
  const guestName = opts.guestName ?? "Bob";
  // Pair each extra page with its resolved username up front so we can
  // iterate without index-access (strict TS + noUncheckedIndexedAccess).
  const extras: { page: Page; name: string }[] = (opts.extraPages ?? []).map(
    (page, i) => ({
      page,
      name: opts.extraNames?.[i] ?? DEFAULT_EXTRA_NAMES[i] ?? `Player${i + 3}`,
    }),
  );

  await setTestUser(host, hostName);
  await setTestUser(guest, guestName);
  for (const { page, name } of extras) {
    await setTestUser(page, name);
  }

  const code = await hostCreatesRoom(host);
  await guestJoinsRoom(guest, code);

  // Wait for guest to appear in host's lobby
  await host.getByText(guestName).waitFor({ timeout: 5000 });

  // Join any extra players sequentially so the host lobby can observe each
  // one (and so the server never sees two join_room races).
  for (const { page, name } of extras) {
    await guestJoinsRoom(page, code);
    await host.getByText(name, { exact: false }).waitFor({ timeout: 5000 });
  }

  if (opts.hostGender) await setPlayerGender(host, opts.hostGender);
  if (opts.guestGender) await setPlayerGender(guest, opts.guestGender);

  await hostSelectsPack(host, opts.pack ?? "pack-test");
  await hostSelectsMode(host, opts.mode ?? "classic");
  // Only pass the serializable AlcoholTestConfig subset — opts also carries
  // Page objects (extraPages) which Playwright's evaluate can't serialize.
  await sendStartGameWithAlcohol(host, {
    frequency: opts.frequency,
    enabledRounds: opts.enabledRounds,
    culSecEndGame: opts.culSecEndGame,
  });

  await host.waitForURL("**/game", { timeout: 10000 });
  await guest.waitForURL("**/game", { timeout: 10000 });
  for (const { page } of extras) {
    await page.waitForURL("**/game", { timeout: 10000 });
  }

  return { code };
}

/**
 * Play N turns in multi mode, answering on whoever is the active player.
 * Uses answerViaUI which tries QCM / VF / texte in order.
 *
 * `extraPages` extends the answerer pool and the transition-detection set
 * so 3+ player games can be driven through the same loop.
 */
export async function playTurnsMulti(
  host: Page,
  guest: Page,
  turns: number,
  opts: { extraPages?: Page[] } = {},
): Promise<number> {
  const extraPages = opts.extraPages ?? [];
  const allPages = [host, guest, ...extraPages];
  for (let q = 0; q < turns; q++) {
    if (allPages.some((p) => p.url().includes("/end"))) {
      return q;
    }
    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});

    // Capture the current question so we can detect the transition to the
    // next one, instead of sleeping through turn_result + scheduleNextQuestion.
    const prevQuestion =
      (await host
        .locator("p.text-xl")
        .textContent()
        .catch(() => "")) ?? "";

    let answered = false;
    for (const player of allPages) {
      if (await answerViaUI(player)) {
        answered = true;
        break;
      }
    }
    if (!answered) {
      // Couldn't answer — check if a special round overlay is already up
      for (const p of allPages) {
        if (await hasAnyRoundOverlay(p)) return q;
      }
    }

    // Wait for one of: question text changes (next turn loaded),
    // an overlay appears (special round), or the game ends.
    // Budget matches the old 4s buffer but returns as soon as observable.
    const questionChanged = (p: Page) =>
      p.waitForFunction(
        (prev) => {
          const el = document.querySelector("p.text-xl");
          const txt = el?.textContent?.trim();
          return !!txt && txt !== prev;
        },
        prevQuestion.trim(),
        { timeout: 8000 },
      );
    await Promise.any([
      ...allPages.map(questionChanged),
      ...allPages.map((p) =>
        anyRoundOverlayLocator(p).waitFor({
          state: "visible",
          timeout: 8000,
        }),
      ),
      ...allPages.map((p) => p.waitForURL("**/end", { timeout: 8000 })),
    ]).catch(() => {});

    // Early exit if special round started on any page
    for (const p of allPages) {
      if (await hasAnyRoundOverlay(p)) return q + 1;
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
    await page.getByText(title).first().waitFor({
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
  const waitOn = (p: Page) =>
    p
      .getByText(title)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs })
      .then(() => p);
  try {
    return await Promise.any([waitOn(host), waitOn(guest)]);
  } catch {
    throw new RoundOverlayTimeoutError(round, timeoutMs);
  }
}

/**
 * Locator matching the first visible overlay title among the 8 round titles.
 * Used with `waitFor({ state: "visible" })` to await "any overlay appeared"
 * without polling in a loop.
 *
 * Regex escape handles the `!` and `é` in titles (they are safe in regex
 * but future-proofs the join against anything punctuation-heavy).
 */
function anyRoundOverlayLocator(page: Page) {
  const pattern = ALL_ROUND_IDS.map((id) =>
    ROUND_TITLES[id].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|");
  return page.getByText(new RegExp(pattern)).first();
}

/** Return true if any of the 8 round overlays is currently visible. */
export async function hasAnyRoundOverlay(page: Page): Promise<boolean> {
  return await anyRoundOverlayLocator(page)
    .isVisible()
    .catch(() => false);
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
 * Wait until one of the two pages shows the given text.
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
  const waitOn = (p: Page) =>
    matcher(p)
      .waitFor({ state: "visible", timeout: timeoutMs })
      .then(() => p);
  try {
    return await Promise.any([waitOn(host), waitOn(guest)]);
  } catch {
    throw new Error(
      `Timeout waiting for text ${JSON.stringify(text)} on either player (${timeoutMs}ms)`,
    );
  }
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
    .getByText(ROUND_TITLES[round])
    .first()
    .waitFor({ state: "hidden", timeout: timeoutMs });
}
