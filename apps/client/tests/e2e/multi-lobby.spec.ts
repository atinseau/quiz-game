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
