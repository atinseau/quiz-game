import {
  expect,
  guestJoinsRoom,
  hostCreatesRoom,
  hostSelectsMode,
  hostSelectsPack,
  setTestUser,
  test,
} from "../helpers/multi-fixtures";

// Multi-device tests must run serially to avoid WS state conflicts
// (the server uses shared in-memory rooms keyed by clerkId)
test.describe.configure({ mode: "serial" });

test.describe("Multi-device lobby", () => {
  test("host creates room and guest joins", async ({ multi }) => {
    const { host, guest } = multi;

    await setTestUser(host, "Alice");
    await setTestUser(guest, "Bob");

    // Host creates room
    const code = await hostCreatesRoom(host);
    expect(code).toHaveLength(6);

    // Host sees the room code (wait longer for WS reconnection)
    await expect(host.getByText(code)).toBeVisible({ timeout: 10000 });

    // Guest joins
    await guestJoinsRoom(guest, code);

    // Both see each other in the player list
    await expect(host.getByText("Bob")).toBeVisible({ timeout: 5000 });
    await expect(guest.getByText("Alice")).toBeVisible({ timeout: 5000 });
  });

  test("host configures pack and mode, guest sees updates", async ({
    multi,
  }) => {
    const { host, guest } = multi;

    await setTestUser(host, "Alice");
    await setTestUser(guest, "Bob");

    const code = await hostCreatesRoom(host);
    await guestJoinsRoom(guest, code);

    // Wait for both to see each other
    await expect(host.getByText(/Bob/)).toBeVisible({ timeout: 5000 });

    // Host selects pack via WS message (UI buttons require isHost which
    // doesn't work in test mode since useAuth().userId is null)
    await hostSelectsPack(host, "pack-test");

    // Both should see the pack selection reflected
    // The non-host view shows pack name if packs are loaded, or slug as fallback
    await expect(guest.getByText("Pack Test", { exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect(host.getByText("Pack Test", { exact: true })).toBeVisible({
      timeout: 5000,
    });

    // Host selects mode via WS message
    await hostSelectsMode(host, "classique");

    // Both should see the mode selection reflected
    // The non-host view shows mode name from GAME_MODES or the raw mode id
    await expect(guest.getByText(/classique|Classique/)).toBeVisible({
      timeout: 5000,
    });
    await expect(host.getByText(/classique|Classique/)).toBeVisible({
      timeout: 5000,
    });
  });

  test("host can reload lobby page without getting stuck", async ({
    multi,
  }) => {
    const { host } = multi;

    await setTestUser(host, "Alice");

    // Host creates room
    const code = await hostCreatesRoom(host);
    expect(code).toHaveLength(6);

    // Verify lobby is visible
    await expect(host.getByText("Code de la room")).toBeVisible({
      timeout: 10000,
    });
    await expect(host.getByText(code)).toBeVisible();

    // Reload the page — this is the bug scenario
    await host.reload();

    // After reload, the lobby should reconnect and show the room again
    // Bug: previously got stuck on "Connexion à la room..." forever
    await expect(host.getByText("Code de la room")).toBeVisible({
      timeout: 10000,
    });
    await expect(host.getByText(code)).toBeVisible({ timeout: 5000 });
  });

  test("host can reload lobby page with guest present", async ({ multi }) => {
    const { host, guest } = multi;

    await setTestUser(host, "Alice");
    await setTestUser(guest, "Bob");

    const code = await hostCreatesRoom(host);
    await guestJoinsRoom(guest, code);

    // Both see each other
    await expect(host.getByText("Bob")).toBeVisible({ timeout: 5000 });
    await expect(guest.getByText("Alice")).toBeVisible({ timeout: 5000 });

    // Host reloads
    await host.reload();

    // Host should reconnect and still see the lobby with both players
    await expect(host.getByText("Code de la room")).toBeVisible({
      timeout: 10000,
    });
    await expect(host.getByText(code)).toBeVisible({ timeout: 5000 });
    await expect(host.getByText("Bob")).toBeVisible({ timeout: 5000 });

    // Guest should still see Alice (reconnected)
    await expect(guest.getByText("Alice")).toBeVisible({ timeout: 5000 });
  });

  test("redirect to /play with toast when lobby code is unknown", async ({
    multi,
  }) => {
    const { host } = multi;
    await setTestUser(host, "Alice");

    await host.goto("/play/lobby/ZZZZZZ");

    await expect(host.getByText("Room introuvable").first()).toBeVisible({
      timeout: 10000,
    });

    await host.waitForURL((url) => url.pathname === "/play", {
      timeout: 10000,
    });
    await expect(host.getByText("Comment tu veux jouer ?")).toBeVisible();
  });

  test("manual URL change to unknown code redirects to /play with toast", async ({
    multi,
  }) => {
    const { host } = multi;
    await setTestUser(host, "Alice");

    // Host creates a room (server-side grace period will try to auto-reconnect)
    const code = await hostCreatesRoom(host);
    expect(code).toHaveLength(6);

    // Simulate manual URL edit to a non-existent code
    await host.goto("/play/lobby/ZZZZZZ");

    await expect(host.getByText("Room introuvable").first()).toBeVisible({
      timeout: 10000,
    });
    await host.waitForURL((url) => url.pathname === "/play", {
      timeout: 10000,
    });
    await expect(host.getByText("Comment tu veux jouer ?")).toBeVisible();
  });

  test("manual URL change to a different valid room switches rooms", async ({
    multi,
  }) => {
    const { host, guest } = multi;
    await setTestUser(host, "Alice");
    await setTestUser(guest, "Bob");

    // Each creates their own room
    const codeA = await hostCreatesRoom(host);
    const codeB = await hostCreatesRoom(guest);
    expect(codeA).not.toBe(codeB);

    // Host manually edits URL to Bob's room code
    await host.goto(`/play/lobby/${codeB}`);

    // Host now sees Bob's room code displayed in the lobby
    await expect(host.getByText("Code de la room")).toBeVisible({
      timeout: 10000,
    });
    await expect(host.getByText(codeB)).toBeVisible({ timeout: 5000 });

    // Bob sees Alice arrive in his room
    await expect(guest.getByText(/Alice/)).toBeVisible({ timeout: 5000 });
  });

  test("shows toast when joining an unknown room from /play/join", async ({
    multi,
  }) => {
    const { guest } = multi;
    await setTestUser(guest, "Bob");

    await guest.goto("/play/join");
    await guest.getByPlaceholder("Ex: A3K9F2").fill("ZZZZZZ");
    await guest.getByRole("button", { name: "Rejoindre" }).click();

    await expect(guest.getByText("Room introuvable").first()).toBeVisible({
      timeout: 10000,
    });

    expect(new URL(guest.url()).pathname).toBe("/play/join");
  });

  test("creating a room twice in a row produces two distinct rooms", async ({
    multi,
  }) => {
    const { host } = multi;
    await setTestUser(host, "Alice");

    // First creation
    const codeA = await hostCreatesRoom(host);
    expect(codeA).toHaveLength(6);

    // Client-side back to /play — Zustand store persists stale room state
    await host.goBack();
    await expect(host.getByText("Comment tu veux jouer ?")).toBeVisible({
      timeout: 10000,
    });

    // Second creation — must produce a fresh room, not resurrect the old one
    await host.getByRole("button", { name: /Créer une partie/ }).click();
    await host.waitForURL("**/play/lobby/**", { timeout: 15000 });
    const urlAfterSecond = host.url();
    const codeB = urlAfterSecond.split("/play/lobby/")[1];

    // No "Room introuvable" toast
    await expect(host.getByText("Room introuvable")).not.toBeVisible();

    // Lobby fully renders (not bounced back to /play)
    await expect(host.getByText("Code de la room")).toBeVisible({
      timeout: 10000,
    });
    await expect(host.getByText(codeB!)).toBeVisible({ timeout: 5000 });

    // Second room must be different from the first
    expect(codeB).not.toBe(codeA);
  });

  test("both players see lobby and waiting state", async ({ multi }) => {
    const { host, guest } = multi;

    await setTestUser(host, "Alice");
    await setTestUser(guest, "Bob");

    const code = await hostCreatesRoom(host);
    await guestJoinsRoom(guest, code);

    await expect(host.getByText(/Bob/)).toBeVisible({ timeout: 5000 });
    await expect(guest.getByText(/Alice/)).toBeVisible({ timeout: 5000 });

    // Both see the room code
    await expect(host.getByText(code)).toBeVisible();
    await expect(guest.getByText(code)).toBeVisible();

    // Host sees pack selection UI, guest sees waiting message
    await expect(host.getByText("Choisis un pack").first()).toBeVisible();
    await expect(guest.getByText(/attente/i)).toBeVisible();
  });
});
