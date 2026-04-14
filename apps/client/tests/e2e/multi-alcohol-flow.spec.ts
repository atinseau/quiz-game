import type { Page } from "@playwright/test";
import {
  answerViaUI,
  expect,
  guestJoinsRoom,
  hostCreatesRoom,
  hostSelectsMode,
  hostSelectsPack,
  setTestUser,
  test,
} from "../helpers/multi-fixtures";

function isAtEnd(host: Page, guest: Page): boolean {
  return host.url().includes("/end") || guest.url().includes("/end");
}

test("Multi-device alcohol: special round triggers after configured turns", async ({
  multi,
}) => {
  test.slow();
  const { host, guest } = multi;

  await setTestUser(host, "Alice");
  await setTestUser(guest, "Bob");

  const code = await hostCreatesRoom(host);
  await guestJoinsRoom(guest, code);
  await expect(host.getByText("Bob")).toBeVisible({ timeout: 5000 });

  await hostSelectsPack(host, "pack-test");
  await hostSelectsMode(host, "classic");

  // Start game with alcohol config: enabled, frequency 3 (trigger after 3 turns)
  await host.evaluate(() => {
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
            frequency: 3,
            enabledRounds: ["petit_buveur", "distributeur", "courage"],
            culSecEndGame: true,
          },
        }),
      );
    }
  });

  // Both should navigate to /game
  await host.waitForURL("**/game", { timeout: 10000 });
  await guest.waitForURL("**/game", { timeout: 10000 });
  await expect(host.locator("p.text-xl")).toBeVisible({ timeout: 10000 });

  // Play 3 turns to trigger a special round
  for (let q = 0; q < 3; q++) {
    if (isAtEnd(host, guest)) break;

    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});

    // Answer on the active player
    for (const player of [host, guest]) {
      if (await answerViaUI(player)) break;
    }

    await host.waitForTimeout(5000);
  }

  // After 3 turns, a special round should trigger
  // Look for special round overlay or drink alert on either screen
  let specialRoundSeen = false;
  for (let i = 0; i < 15; i++) {
    // Check for any alcohol-related text on either page
    for (const player of [host, guest]) {
      const petitBuveur = await player
        .getByText("Petit buveur")
        .isVisible()
        .catch(() => false);
      const distributeur = await player
        .getByText("Distributeur")
        .isVisible()
        .catch(() => false);
      const courage = await player
        .getByText("Question de courage")
        .isVisible()
        .catch(() => false);
      const drinkAlert = await player
        .getByText(/boit une gorgée|gorgée|CUL SEC|moitié du verre/)
        .isVisible()
        .catch(() => false);

      if (petitBuveur || distributeur || courage || drinkAlert) {
        specialRoundSeen = true;
        break;
      }
    }
    if (specialRoundSeen) break;
    await host.waitForTimeout(1000);
  }

  // We should have seen at least one special round element
  expect(specialRoundSeen).toBe(true);
});
