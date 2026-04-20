// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-FLOW-3
//
// Repro for: `endSpecialRound` (src/server/alcohol/framework.ts:137-139)
// broadcasts `special_round_end` (→ client removes the overlay) and then
// schedules `_onRoundEnd(room)` via `setTimeout(..., 1000)`. `_onRoundEnd`
// is the callback that triggers the next `sendQuestion(room)`. During that
// 1 second window the overlay is already gone on the client but no new
// `question` message has arrived — so the page keeps showing the *previous*
// turn's question text and scoreboard. Visible flash of stale UI.
//
// This test forces a single `petit_buveur` round, then measures the delay
// between the overlay disappearing and the `p.text-xl` question text
// changing. To be robust against the stale-display window (same text
// visible before and after — just not updated), we capture the original
// question text BEFORE triggering the round and wait for the text to change.
//
// Marked `test.fail` — will pass once the 1s timeout is removed/reduced
// (e.g. send `question` before `special_round_end`, or let the overlay stay
// mounted until the next `question` arrives).

import {
  expect,
  ROUND_TITLES,
  startMultiAlcoholGame,
  multiTest as test,
  waitForRoundOverlayAnyPlayer,
} from "../../helpers/alcohol-fixtures";
import { submitAnswerViaWs } from "../../helpers/multi-fixtures";

test.describe("BUG-FLOW-3 — 1s stale UI gap between special_round_end and next question", () => {
  test("no visible stale UI between round end and next question", async ({
    multi,
  }) => {
    test.slow();
    const { host, guest } = multi;

    await startMultiAlcoholGame(host, guest, {
      frequency: 1,
      enabledRounds: ["petit_buveur"],
    });

    // Wait for Q1 to render on host.
    const questionLocator = host.locator("p.text-xl");
    await questionLocator.waitFor({ state: "visible", timeout: 10000 });
    const firstQuestionText =
      (await questionLocator.textContent())?.trim() ?? "";

    // Submit any answer for Q1 via WS (string works for any question type
    // since we don't care whether it's correct — we just want the turn to
    // resolve and trigger the round).
    await submitAnswerViaWs(host, "__REPRO_ANSWER__");

    // petit_buveur overlay appears on at least one page.
    const victim = await waitForRoundOverlayAnyPlayer(
      host,
      guest,
      "petit_buveur",
      20000,
    );

    // Wait for the overlay to auto-close (server: setTimeout 5000ms then
    // endSpecialRound → broadcast special_round_end → client hides it).
    await victim
      .getByText(ROUND_TITLES.petit_buveur, { exact: true })
      .first()
      .waitFor({ state: "hidden", timeout: 15000 });
    const overlayClosedAt = Date.now();

    // After special_round_end, the client has removed the overlay but
    // `p.text-xl` still shows the PREVIOUS question text until the next
    // `question` message arrives ~1s later. Wait for the text to change
    // away from what it was before the special round.
    //
    // We poll because Playwright's waitFor state="visible" is not enough
    // (text is already visible — just stale). We use a short polling loop
    // with a tight interval to capture the gap duration precisely.
    const questionOnVictim = victim.locator("p.text-xl");
    const deadline = overlayClosedAt + 5000;
    let questionChangedAt: number | null = null;
    while (Date.now() < deadline) {
      const current = (
        await questionOnVictim.textContent().catch(() => null)
      )?.trim();
      if (
        current !== undefined &&
        current !== null &&
        current !== "" &&
        current !== firstQuestionText
      ) {
        questionChangedAt = Date.now();
        break;
      }
      await victim.waitForTimeout(50);
    }

    expect(
      questionChangedAt,
      "next question never arrived within 5s of overlay close",
    ).not.toBeNull();

    const gapMs = (questionChangedAt as number) - overlayClosedAt;
    // EXPECTED (fails today because of the hard-coded setTimeout(1000)):
    // the next question should arrive ~immediately after the overlay
    // closes. Threshold kept generous (300ms) to allow for WS + render
    // latency without accepting the 1s setTimeout bug.
    expect(gapMs).toBeLessThan(300);
  });
});
