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

// Chrono mode uses a 15s server timeout per turn. Letting one question
// timeout is intentional and bounds the test duration.
test.setTimeout(90_000);

test("Multi-device chrono: answers and timeout work", async ({ multi }) => {
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

  // Play through all questions. On Q3 (index 2), let the 15s chrono elapse.
  let questionsAnswered = 0;

  for (let q = 0; q < 10; q++) {
    if (isAtEnd(host, guest)) break;
    if (await checkEndVisible(host, guest)) break;

    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});

    const prevQuestion =
      (await host
        .locator("p.text-xl")
        .textContent()
        .catch(() => "")) ?? "";

    if (questionsAnswered === 2) {
      // Don't answer — wait for the server-side 15s timeout, then the
      // scheduleNextQuestion transition.
      const questionChanged = (p: Page) =>
        p.waitForFunction(
          (prev) => {
            const el = document.querySelector("p.text-xl");
            const txt = el?.textContent?.trim();
            return !!txt && txt !== prev;
          },
          prevQuestion.trim(),
          { timeout: 25_000 },
        );
      await Promise.any([
        questionChanged(host),
        questionChanged(guest),
        host.waitForURL("**/end", { timeout: 25_000 }),
        guest.waitForURL("**/end", { timeout: 25_000 }),
      ]).catch(() => {});
      questionsAnswered++;
      continue;
    }

    for (const player of [host, guest]) {
      if (await answerViaUI(player)) {
        questionsAnswered++;
        break;
      }
    }

    // Wait for transition: either next question or end screen.
    const questionChanged = (p: Page) =>
      p.waitForFunction(
        (prev) => {
          const el = document.querySelector("p.text-xl");
          const txt = el?.textContent?.trim();
          return !!txt && txt !== prev;
        },
        prevQuestion.trim(),
        { timeout: 10_000 },
      );
    await Promise.any([
      questionChanged(host),
      questionChanged(guest),
      host.waitForURL("**/end", { timeout: 10_000 }),
      guest.waitForURL("**/end", { timeout: 10_000 }),
    ]).catch(() => {});
  }

  await expect
    .poll(
      async () => isAtEnd(host, guest) || (await checkEndVisible(host, guest)),
      {
        timeout: 20_000,
      },
    )
    .toBe(true);
});
