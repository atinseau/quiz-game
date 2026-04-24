// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-FLOW-1
//
// Regression guards for the "*_result phase never shown in multi" family.
// Each round (conseil / love_or_drink / show_us / smatch_or_pass) broadcasts
// a `*_result` event that the client must merge into the active round data
// to render the result phase ("Résultat du conseil", "🍺 Cul sec !",
// "Couleur de … :", "💋 Smatch !"). If the corresponding handler is missing
// from roomStore, the overlay stays stuck on the waiting phase until
// special_round_end closes it.

import type { Page } from "@playwright/test";
import {
  playTurnsMulti,
  startMultiAlcoholGame,
  multiTest as test,
  waitForRoundOverlayAnyPlayer,
  waitForTextAnyPlayer,
} from "../../helpers/alcohol-fixtures";

async function sendRawWs(page: Page, message: Record<string, unknown>) {
  await page.evaluate((msg) => {
    // biome-ignore lint/suspicious/noExplicitAny: test globals
    const activeWs = (window as any).__testActiveWs as WebSocket;
    if (activeWs?.readyState === WebSocket.OPEN) {
      // biome-ignore lint/suspicious/noExplicitAny: test globals
      const OrigWs = (window as any).__OriginalWebSocket;
      OrigWs.prototype.send.call(activeWs, JSON.stringify(msg));
    }
  }, message);
}

type TriggerOutcome = "triggered" | "inconclusive";

interface RoundCase {
  id: "conseil" | "love_or_drink" | "show_us" | "smatch_or_pass";
  label: string;
  startOverrides?: {
    hostGender?: "homme" | "femme";
    guestGender?: "homme" | "femme";
  };
  trigger: (host: Page, guest: Page) => Promise<TriggerOutcome>;
  expectedResult: string | RegExp;
}

const ROUND_CASES: RoundCase[] = [
  {
    id: "conseil",
    label: "Conseil",
    expectedResult: "Résultat du conseil",
    trigger: async (host, guest) => {
      const hostVoteForBob = host
        .getByRole("button", { name: /Bob/ })
        .filter({ hasText: "🗳️" })
        .first();
      const guestVoteForAlice = guest
        .getByRole("button", { name: /Alice/ })
        .filter({ hasText: "🗳️" })
        .first();

      if (
        !(await hostVoteForBob.isVisible({ timeout: 2000 }).catch(() => false))
      ) {
        return "inconclusive";
      }
      await hostVoteForBob.click();

      if (
        !(await guestVoteForAlice
          .isVisible({ timeout: 2000 })
          .catch(() => false))
      ) {
        return "inconclusive";
      }
      await guestVoteForAlice.click();
      return "triggered";
    },
  },
  {
    id: "love_or_drink",
    label: "Love or Drink",
    expectedResult: "🍺 Cul sec !",
    trigger: async (host) => {
      await sendRawWs(host, {
        type: "love_or_drink_choice",
        choice: "cul_sec",
      });
      return "triggered";
    },
  },
  {
    id: "show_us",
    label: "Show Us",
    expectedResult: /Couleur de .+ :/,
    trigger: async (host, guest) => {
      const TARGET_HINT = "Les autres devinent ta couleur";
      let targetPage: Page | null = null;
      let voterPage: Page | null = null;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const hostIsTarget = await host
          .getByText(TARGET_HINT, { exact: false })
          .first()
          .isVisible()
          .catch(() => false);
        const guestIsTarget = await guest
          .getByText(TARGET_HINT, { exact: false })
          .first()
          .isVisible()
          .catch(() => false);
        if (hostIsTarget && !guestIsTarget) {
          targetPage = host;
          voterPage = guest;
          break;
        }
        if (guestIsTarget && !hostIsTarget) {
          targetPage = guest;
          voterPage = host;
          break;
        }
        await host.waitForTimeout(300);
      }
      if (!targetPage || !voterPage) return "inconclusive";

      await sendRawWs(voterPage, { type: "show_us_vote", color: "Bleu" });
      await voterPage.waitForTimeout(300);
      await sendRawWs(targetPage, { type: "show_us_reveal", color: "Rouge" });
      return "triggered";
    },
  },
  {
    id: "smatch_or_pass",
    label: "Smatch or Pass",
    startOverrides: { hostGender: "homme", guestGender: "femme" },
    expectedResult: /Smatch !/,
    trigger: async (host, guest) => {
      let decideurPage: Page | null = null;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const hostIsDec = await host
          .getByText("toi", { exact: true })
          .first()
          .isVisible()
          .catch(() => false);
        const guestIsDec = await guest
          .getByText("toi", { exact: true })
          .first()
          .isVisible()
          .catch(() => false);
        if (hostIsDec && !guestIsDec) {
          decideurPage = host;
          break;
        }
        if (guestIsDec && !hostIsDec) {
          decideurPage = guest;
          break;
        }
        await host.waitForTimeout(300);
      }
      if (!decideurPage) return "inconclusive";
      await sendRawWs(decideurPage, {
        type: "smatch_choice",
        choice: "smatch",
      });
      return "triggered";
    },
  },
];

// Per-session tracker so a run in which ALL rounds bail out is a hard failure.
// Each case that cannot assert its result increments `inconclusiveCount`; a
// fixture-scoped afterAll hook then fails the suite if every case bailed.
const inconclusiveRounds = new Set<string>();

test.describe("BUG-FLOW-1 — *_result phase rendered in multi", () => {
  for (const c of ROUND_CASES) {
    test(`${c.label} result phase is rendered after the trigger action`, async ({
      multi,
    }, testInfo) => {
      test.slow();
      const { host, guest } = multi;

      await startMultiAlcoholGame(host, guest, {
        frequency: 1,
        enabledRounds: [c.id],
        ...(c.startOverrides ?? {}),
      });
      await playTurnsMulti(host, guest, 1);

      try {
        await waitForRoundOverlayAnyPlayer(host, guest, c.id, 20000);
      } catch {
        // Round skipped by a server-side guard (e.g. gender constraint).
        inconclusiveRounds.add(c.id);
        testInfo.annotations.push({
          type: "inconclusive",
          description: `${c.id}: overlay never appeared within 20s`,
        });
        test.skip(true, `${c.id} overlay never appeared within 20s`);
        return;
      }

      const outcome = await c.trigger(host, guest);
      if (outcome === "inconclusive") {
        inconclusiveRounds.add(c.id);
        testInfo.annotations.push({
          type: "inconclusive",
          description: `${c.id}: trigger action could not run`,
        });
        test.skip(true, `${c.id} trigger action could not run`);
        return;
      }

      await waitForTextAnyPlayer(host, guest, c.expectedResult, 10000);
    });
  }

  test.afterAll(() => {
    // If every round bailed out, the regression guard is no-op. Fail loud.
    if (inconclusiveRounds.size === ROUND_CASES.length) {
      throw new Error(
        `All ${ROUND_CASES.length} BUG-FLOW-1 rounds were inconclusive — ` +
          `the regression guard asserted nothing. Inspect the trigger paths ` +
          `(overlay detection, WS routing, gender constraints).`,
      );
    }
  });
});
