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

test("Multi-device: two players complete a classic game", async ({ multi }) => {
  const { host, guest } = multi;

  await setTestUser(host, "Alice");
  await setTestUser(guest, "Bob");

  // Setup: create room, join, configure, start
  const code = await hostCreatesRoom(host);
  await guestJoinsRoom(guest, code);
  await expect(host.getByText("Bob")).toBeVisible({ timeout: 5000 });

  await hostSelectsPack(host, "pack-test");
  await hostSelectsMode(host, "classic");
  await hostStartsGame(host);

  // Both should navigate to /game
  await host.waitForURL("**/game", { timeout: 10000 });
  await guest.waitForURL("**/game", { timeout: 10000 });

  // First question should appear
  await expect(host.locator("p.text-xl")).toBeVisible({ timeout: 10000 });

  // Play through all questions — stop as soon as anyone reaches the end screen.
  const maxQuestions = 8;

  for (let q = 0; q < maxQuestions; q++) {
    if (host.url().includes("/end") || guest.url().includes("/end")) break;

    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});

    const prevQuestion =
      (await host
        .locator("p.text-xl")
        .textContent()
        .catch(() => "")) ?? "";

    for (const player of [host, guest]) {
      if (await answerViaUI(player)) break;
    }

    // Wait for transition instead of a fixed 5s sleep.
    const questionChanged = (p: typeof host) =>
      p.waitForFunction(
        (prev) => {
          const el = document.querySelector("p.text-xl");
          const txt = el?.textContent?.trim();
          return !!txt && txt !== prev;
        },
        prevQuestion.trim(),
        { timeout: 8000 },
      );
    await Promise.any([
      questionChanged(host),
      questionChanged(guest),
      host.waitForURL("**/end", { timeout: 8000 }),
      guest.waitForURL("**/end", { timeout: 8000 }),
    ]).catch(() => {});
  }

  // Final assertion: someone reached the end screen.
  const endCondition = async () => {
    if (host.url().includes("/end") || guest.url().includes("/end")) {
      return true;
    }
    const hostEnd = await host
      .getByText(/Fin de la partie/)
      .isVisible()
      .catch(() => false);
    const guestEnd = await guest
      .getByText(/Fin de la partie/)
      .isVisible()
      .catch(() => false);
    return hostEnd || guestEnd;
  };
  await expect.poll(endCondition, { timeout: 20000 }).toBe(true);
});
