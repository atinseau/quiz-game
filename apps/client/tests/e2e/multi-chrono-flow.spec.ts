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

test("Multi-device chrono: answers and timeout work", async ({ multi }) => {
  test.slow();
  const { host, guest } = multi;

  await setTestUser(host, "Alice");
  await setTestUser(guest, "Bob");

  const code = await hostCreatesRoom(host);
  await guestJoinsRoom(guest, code);
  await expect(host.getByText("Bob")).toBeVisible({ timeout: 5000 });

  await hostSelectsPack(host, "pack-test");
  await hostSelectsMode(host, "chrono");
  await hostStartsGame(host);

  await host.waitForURL("**/game", { timeout: 10000 });
  await guest.waitForURL("**/game", { timeout: 10000 });
  await expect(host.locator("p.text-xl")).toBeVisible({ timeout: 10000 });

  // Play through all questions
  // In chrono mode, one player per turn (alternating), 15s server timeout
  // We'll let Q2 (third question, index 2) timeout by not answering
  let questionsAnswered = 0;

  for (let q = 0; q < 10; q++) {
    if (isAtEnd(host, guest)) break;
    if (await checkEndVisible(host, guest)) break;

    // Wait for a question to be visible
    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});

    // On the 3rd question (index 2), let it timeout
    if (questionsAnswered === 2) {
      // Wait for the 15s chrono timeout + 3s next question delay + buffer
      await host.waitForTimeout(20000);
      questionsAnswered++;
      continue;
    }

    // Try to answer on the active player (try both, only one will have enabled inputs)
    let answered = false;
    for (const player of [host, guest]) {
      if (await answerViaUI(player)) {
        answered = true;
        break;
      }
    }

    if (answered) {
      questionsAnswered++;
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
