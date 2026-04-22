// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-FLOW-3
//
// Regression guard for: `endSpecialRound` used to `setTimeout(_onRoundEnd, 1000)`
// after broadcasting `special_round_end`. The overlay closed immediately, but
// the next `question` arrived 1 second later — leaving the previous turn's
// stale text and scoreboard visible during the gap. Fix removes/reduces the
// timeout so the next question arrives synchronously with (or before) the
// overlay closing.
//
// This test forces one `petit_buveur` round and measures the gap between
// overlay disappearance and `p.text-xl` question-text change. Asserts the
// window is below the stale-UI threshold. Failure means the 1s delay returned.

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
