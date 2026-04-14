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

test.describe("Multi-device classic game flow", () => {
  test("two players complete a classic game", async ({ multi }) => {
    const { host, guest } = multi;

    await setTestUser(host, "Alice");
    await setTestUser(guest, "Bob");

    // Setup: create room, join, configure, start
    const code = await hostCreatesRoom(host);
    await guestJoinsRoom(guest, code);
    await expect(host.getByText("Bob")).toBeVisible({ timeout: 5000 });

    await hostSelectsPack(host, "Pack Test");
    await hostSelectsMode(host, "Classique");
    await hostStartsGame(host);

    // Both should navigate to /game
    await host.waitForURL("**/game", { timeout: 10000 });
    await guest.waitForURL("**/game", { timeout: 10000 });

    // A question should be visible on both screens
    await expect(host.locator("p.text-xl")).toBeVisible({ timeout: 5000 });
    await expect(guest.locator("p.text-xl")).toBeVisible({ timeout: 5000 });

    // Play through questions until end screen
    // In classic mode, only one player answers per turn
    // We don't know who's first, so we check both and answer whichever is active
    let questionCount = 0;
    const maxQuestions = 10;

    while (questionCount < maxQuestions) {
      // Check if either player reached end screen
      if (host.url().includes("/end") || guest.url().includes("/end")) break;

      // Wait for question to appear
      await host.waitForTimeout(500);

      // Try answering on both — the active player's inputs are enabled
      for (const player of [host, guest]) {
        try {
          // Try VF button
          const vraiBtn = player.getByRole("button", {
            name: "Vrai",
            exact: true,
          });
          if (await vraiBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            if (await vraiBtn.isEnabled({ timeout: 200 }).catch(() => false)) {
              await vraiBtn.click();
              break;
            }
          }
          // Try texte input
          const texteInput = player.getByPlaceholder("Votre reponse...");
          if (await texteInput.isVisible({ timeout: 500 }).catch(() => false)) {
            if (
              await texteInput.isEnabled({ timeout: 200 }).catch(() => false)
            ) {
              await texteInput.fill("test");
              await texteInput.press("Enter");
              break;
            }
          }
          // Try QCM — click first enabled button
          const qcmBtn = player.locator(".grid button").first();
          if (await qcmBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            if (await qcmBtn.isEnabled({ timeout: 200 }).catch(() => false)) {
              await qcmBtn.click();
              break;
            }
          }
        } catch {
          // Not this player's turn, try the other
        }
      }

      questionCount++;
      // Wait for turn result + next question (3s server delay)
      await host.waitForTimeout(4000);
    }

    // At least one player should reach the end screen
    await expect(
      host
        .getByText(/Fin de la partie|pts/)
        .or(guest.getByText(/Fin de la partie|pts/)),
    ).toBeVisible({ timeout: 15000 });
  });
});
