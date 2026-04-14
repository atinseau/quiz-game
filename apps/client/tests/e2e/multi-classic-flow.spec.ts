import {
  expect,
  guestJoinsRoom,
  hostCreatesRoom,
  hostSelectsMode,
  hostSelectsPack,
  hostStartsGame,
  setTestUser,
  test,
} from "../helpers/multi-fixtures";

test.setTimeout(120_000);

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

  // Play through all questions
  const maxQuestions = 8;

  for (let q = 0; q < maxQuestions; q++) {
    // Check if we reached end screen
    if (host.url().includes("/end") || guest.url().includes("/end")) break;

    // Wait for a question to be visible (not feedback)
    // The question text is in p.text-xl
    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});

    // Try to answer on the active player
    let answered = false;
    for (const player of [host, guest]) {
      // QCM: grid buttons
      const qcmBtns = player.locator(".grid button");
      const qcmCount = await qcmBtns.count().catch(() => 0);
      if (qcmCount > 0) {
        const firstBtn = qcmBtns.first();
        if (await firstBtn.isEnabled({ timeout: 500 }).catch(() => false)) {
          await firstBtn.click();
          answered = true;
          break;
        }
      }

      // VF: Vrai/Faux buttons
      const vraiBtn = player.getByRole("button", { name: "Vrai", exact: true });
      if (await vraiBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        if (await vraiBtn.isEnabled({ timeout: 200 }).catch(() => false)) {
          await vraiBtn.click();
          answered = true;
          break;
        }
      }

      // Texte: input field
      const texteInput = player.getByPlaceholder("Votre reponse...");
      if (await texteInput.isVisible({ timeout: 300 }).catch(() => false)) {
        if (await texteInput.isEnabled({ timeout: 200 }).catch(() => false)) {
          await texteInput.fill("Paris");
          await texteInput.press("Enter");
          answered = true;
          break;
        }
      }
    }

    // Wait for turn result (3s) + next question transition
    // The server sends turn_result, waits 3s, then sends next question
    await host.waitForTimeout(5000);
  }

  // Wait for end screen
  // Either via URL change or game_over rendering
  let ended = false;
  for (let i = 0; i < 20; i++) {
    if (host.url().includes("/end") || guest.url().includes("/end")) {
      ended = true;
      break;
    }
    const hostEnd = await host
      .getByText(/Fin de la partie/)
      .isVisible()
      .catch(() => false);
    const guestEnd = await guest
      .getByText(/Fin de la partie/)
      .isVisible()
      .catch(() => false);
    if (hostEnd || guestEnd) {
      ended = true;
      break;
    }
    await host.waitForTimeout(1000);
  }

  expect(ended).toBe(true);
});
