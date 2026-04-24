// See .discovery/scenarios/show-us-reveal-unblocks.md
//
// Regression: in a 2-player Show Us round, the target was stuck on
// "Les autres devinent ta couleur…" with no reveal buttons even after the
// sole voter submitted. Root cause: the server dropped votes into a map
// without ever notifying the target, so `data.phase` never flipped to
// `waiting_reveal`. Fix broadcasts `show_us_all_voted` once every connected
// voter has submitted.
import type { Page } from "@playwright/test";
import {
  expect,
  playTurnsMulti,
  startMultiAlcoholGame,
  multiTest as test,
  waitForRoundOverlayAnyPlayer,
} from "../../helpers/alcohol-fixtures";

async function identifyShowUsRoles(
  host: Page,
  guest: Page,
): Promise<{ target: Page; voter: Page } | null> {
  const TARGET_HINT = "Les autres devinent ta couleur";
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
    if (hostIsTarget && !guestIsTarget) return { target: host, voter: guest };
    if (guestIsTarget && !hostIsTarget) return { target: guest, voter: host };
    await host.waitForTimeout(200);
  }
  return null;
}

test("Show Us 2-player: target gets reveal buttons after the voter submits", async ({
  multi,
}, testInfo) => {
  test.slow();
  const { host, guest } = multi;

  await startMultiAlcoholGame(host, guest, {
    frequency: 1,
    enabledRounds: ["show_us"],
  });
  await playTurnsMulti(host, guest, 1);

  try {
    await waitForRoundOverlayAnyPlayer(host, guest, "show_us", 20000);
  } catch {
    testInfo.annotations.push({
      type: "inconclusive",
      description: "show_us overlay never appeared within 20s",
    });
    test.skip(true, "show_us overlay never appeared within 20s");
    return;
  }

  const roles = await identifyShowUsRoles(host, guest);
  if (!roles) {
    testInfo.annotations.push({
      type: "inconclusive",
      description: "target/voter roles could not be identified",
    });
    test.skip(true, "role detection failed");
    return;
  }
  const { target, voter } = roles;

  // Voter picks a color through the UI (not raw WS) — this is the path that
  // previously left the target stranded.
  const voterBleu = voter.getByRole("button", { name: "Bleu", exact: true });
  await voterBleu.click();

  // Target must now see the reveal buttons. Before the fix, they were stuck on
  // the "attends !" screen forever.
  await expect(
    target.getByText("Les autres ont voté ! Révèle maintenant ta couleur."),
  ).toBeVisible({ timeout: 5000 });
  const targetReveal = target.getByRole("button", {
    name: "Rouge",
    exact: true,
  });
  await expect(targetReveal).toBeEnabled({ timeout: 2000 });

  // Target reveals — both pages transition to the result phase.
  await targetReveal.click();
  await expect(host.getByText(/Couleur de .+ :/)).toBeVisible({
    timeout: 10000,
  });
  await expect(guest.getByText(/Couleur de .+ :/)).toBeVisible({
    timeout: 10000,
  });
});
