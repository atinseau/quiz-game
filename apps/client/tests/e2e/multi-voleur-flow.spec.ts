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
  test,
} from "../helpers/multi-fixtures";

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

test("Multi-device voleur: both players answer and game completes", async ({
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
  await hostSelectsMode(host, "voleur");
  await hostStartsGame(host);

  await host.waitForURL("**/game", { timeout: 10000 });
  await guest.waitForURL("**/game", { timeout: 10000 });
  await expect(host.locator("p.text-xl")).toBeVisible({ timeout: 10000 });

  // Play through all questions
  // In voleur mode, BOTH players answer each turn
  for (let q = 0; q < 10; q++) {
    if (isAtEnd(host, guest)) break;
    if (await checkEndVisible(host, guest)) break;

    // Wait for a question to be visible
    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});

    // Both players try to answer (voleur mode: both have inputs enabled)
    for (const player of [host, guest]) {
      await answerViaUI(player);
    }

    // Wait for turn result (3s) + next question transition
    await host.waitForTimeout(5000);
  }

  // Wait for end screen
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
