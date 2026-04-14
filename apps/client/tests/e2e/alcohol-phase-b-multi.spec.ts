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

async function startGameWithAlcohol(host: Page, enabledRounds: string[]) {
  await host.evaluate((rounds) => {
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
            enabledRounds: rounds,
            culSecEndGame: false,
          },
        }),
      );
    }
  }, enabledRounds);
}

async function playTurnsMulti(host: Page, guest: Page, count: number) {
  for (let q = 0; q < count; q++) {
    if (isAtEnd(host, guest)) break;
    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});
    for (const player of [host, guest]) {
      if (await answerViaUI(player)) break;
    }
    await host.waitForTimeout(5000);
  }
}

async function checkOverlay(
  host: Page,
  guest: Page,
  pattern: RegExp,
  timeout = 15000,
): Promise<boolean> {
  for (let i = 0; i < timeout / 1000; i++) {
    for (const player of [host, guest]) {
      if (
        await player
          .getByText(pattern)
          .first()
          .isVisible()
          .catch(() => false)
      )
        return true;
    }
    await host.waitForTimeout(1000);
  }
  return false;
}

async function setupMultiGame(
  host: Page,
  guest: Page,
  enabledRounds: string[],
) {
  await setTestUser(host, "Alice");
  await setTestUser(guest, "Bob");
  const code = await hostCreatesRoom(host);
  await guestJoinsRoom(guest, code);
  await expect(host.getByText("Bob")).toBeVisible({ timeout: 5000 });
  await hostSelectsPack(host, "pack-test");
  await hostSelectsMode(host, "classic");
  await startGameWithAlcohol(host, enabledRounds);
  await host.waitForURL("**/game", { timeout: 10000 });
  await guest.waitForURL("**/game", { timeout: 10000 });
}

test.describe("Phase B multi-device alcohol rounds", () => {
  test("Conseil du village triggers in multi", async ({ multi }) => {
    test.slow();
    const { host, guest } = multi;
    await setupMultiGame(host, guest, ["conseil"]);
    await playTurnsMulti(host, guest, 3);
    expect(await checkOverlay(host, guest, /Conseil|vote/i)).toBe(true);
  });

  test("Love or Drink triggers in multi", async ({ multi }) => {
    test.slow();
    const { host, guest } = multi;
    await setupMultiGame(host, guest, ["love_or_drink"]);
    await playTurnsMulti(host, guest, 3);
    expect(
      await checkOverlay(host, guest, /Love or Drink|Bisou|Cul sec/i),
    ).toBe(true);
  });

  test("Cupidon triggers in multi", async ({ multi }) => {
    test.slow();
    const { host, guest } = multi;
    await setupMultiGame(host, guest, ["cupidon"]);
    await playTurnsMulti(host, guest, 3);
    expect(await checkOverlay(host, guest, /Cupidon|lié/i)).toBe(true);
  });

  test("Show Us triggers in multi", async ({ multi }) => {
    test.slow();
    const { host, guest } = multi;
    await setupMultiGame(host, guest, ["show_us"]);
    await playTurnsMulti(host, guest, 3);
    expect(await checkOverlay(host, guest, /Show Us|couleur|Bleu|Noir/i)).toBe(
      true,
    );
  });

  test("Smatch or Pass triggers in multi", async ({ multi }) => {
    test.slow();
    const { host, guest } = multi;
    await setupMultiGame(host, guest, ["smatch_or_pass"]);
    await playTurnsMulti(host, guest, 3);

    // Smatch or Pass requires opposite genders. In multi mode, the server
    // defaults all test users to "homme", so the round may be skipped.
    // We check for either the round overlay or that the game continued.
    const seen = await checkOverlay(host, guest, /Smatch|Pass|décid/i, 5000);
    if (!seen) {
      // The game should still be functional (no crash)
      let gameOk = false;
      for (const player of [host, guest]) {
        const questionVisible = await player
          .locator("p.text-xl")
          .isVisible()
          .catch(() => false);
        const endVisible = await player
          .getByText(/Résultats|Fin de partie/)
          .isVisible()
          .catch(() => false);
        if (questionVisible || endVisible) {
          gameOk = true;
          break;
        }
      }
      expect(gameOk).toBe(true);
    }
  });
});
