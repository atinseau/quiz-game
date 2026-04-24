// Regression: when a Conseil vote ends in a 3-way tie (each of three voters
// picks a different target), the server must broadcast a `conseil_tiebreaker`
// payload, the clients spin the fortune wheel, and exactly ONE player shows
// the personalized "C'est pour toi !" drink alert. The other two must see
// the observer verdict "C'est pour {name} !".
//
// This test locks in the full server + client tiebreaker flow introduced by
// D3/D4: server tie resolution, ConseilWheel component, Conseil.tsx phase
// machine (vote → reveal → spin → result), and DrinkAlert personalization.

import { expect } from "@playwright/test";
import {
  playTurnsMulti,
  startMultiAlcoholGame,
} from "../../helpers/alcohol-fixtures";
import { test } from "../../helpers/multi-fixtures";

test.describe("Conseil — 3-way tie → fortune wheel → single loser", () => {
  test("three voters split three ways → wheel picks one, only that player is notified", async ({
    multi,
  }) => {
    test.slow();
    const { host, guest, third } = multi;

    await startMultiAlcoholGame(host, guest, {
      frequency: 3,
      enabledRounds: ["conseil"],
      extraPages: [third],
    });

    await playTurnsMulti(host, guest, 3, { extraPages: [third] });

    // 1. Conseil vote overlay appears on all 3 clients
    await Promise.all([
      expect(host.getByText("Conseil du village")).toBeVisible({
        timeout: 15000,
      }),
      expect(guest.getByText("Conseil du village")).toBeVisible({
        timeout: 15000,
      }),
      expect(third.getByText("Conseil du village")).toBeVisible({
        timeout: 15000,
      }),
    ]);

    // 2. Each player votes for a DIFFERENT target so the 3 votes split 1-1-1
    //    across all three players (a true 3-way tie):
    //    - Alice (host)  → votes for Bob
    //    - Bob   (guest) → votes for Carol
    //    - Carol (third) → votes for Alice
    //    We cannot match by plain username because setTestUser suffixes each
    //    name with the per-test __testId (e.g. "Alice-1714000000-1"). Match
    //    against the exported `__testUserName` attached to each Page.
    //    biome-ignore lint/suspicious/noExplicitAny: test-only metadata
    const uname = (p: typeof host): string => (p as any).__testUserName;
    const voteFor = async (voter: typeof host, target: typeof host) => {
      const btn = voter.getByRole("button", {
        name: new RegExp(`🗳️\\s*${uname(target)}`),
      });
      await btn.click({ force: true });
    };
    await voteFor(host, guest); // Alice → Bob
    await voteFor(guest, third); // Bob → Carol
    await voteFor(third, host); // Carol → Alice

    // 3. "Égalité !" reveal overlay on all 3
    await Promise.all([
      expect(host.getByText("Égalité !")).toBeVisible({ timeout: 5000 }),
      expect(guest.getByText("Égalité !")).toBeVisible({ timeout: 5000 }),
      expect(third.getByText("Égalité !")).toBeVisible({ timeout: 5000 }),
    ]);

    // 4. Fortune wheel visible (svg aria-label) on all 3
    await Promise.all([
      expect(host.getByLabel("Roue de la fortune")).toBeVisible({
        timeout: 5000,
      }),
      expect(guest.getByLabel("Roue de la fortune")).toBeVisible({
        timeout: 5000,
      }),
      expect(third.getByLabel("Roue de la fortune")).toBeVisible({
        timeout: 5000,
      }),
    ]);

    // 5. After reveal (1.5s) + spin (4s) + settle (0.8s) + drink alert fires,
    //    exactly ONE client shows "C'est pour toi !" AND the other two show
    //    the observer verdict "C'est pour {name} !".
    //
    //    We must assert BOTH views concurrently because the DrinkAlert has a
    //    4s auto-close duration: if we first wait 12s for the winner on all
    //    3 pages (observers each timing out on "toi") the alert would already
    //    be gone on the observers by the time we assert their verdict.
    const pages = [host, guest, third];
    const verdictResults = await Promise.all(
      pages.map(async (p) => {
        // Whichever verdict appears first wins; a missed overlay leaves
        // kind = "none" and makes the downstream assertion fail loudly.
        const winner = p
          .getByText("C'est pour toi !")
          .waitFor({ state: "visible", timeout: 12000 })
          .then(() => "winner" as const);
        // Observer regex must exclude "toi" so it can't also match the
        // winner's "C'est pour toi !" copy.
        const observer = p
          .getByText(/^C'est pour (?!toi !$).+ !$/)
          .waitFor({ state: "visible", timeout: 12000 })
          .then(() => "observer" as const);
        return Promise.any([winner, observer]).catch(() => "none" as const);
      }),
    );

    const winnerCount = verdictResults.filter((r) => r === "winner").length;
    const observerCount = verdictResults.filter((r) => r === "observer").length;
    expect(winnerCount).toBe(1);
    expect(observerCount).toBe(2);
  });
});
