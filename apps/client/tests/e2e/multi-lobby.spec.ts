import {
  expect,
  guestJoinsRoom,
  hostCreatesRoom,
  hostSelectsMode,
  hostSelectsPack,
  setTestUser,
  test,
} from "../helpers/multi-fixtures";

test.describe("Multi-device lobby", () => {
  test("host creates room and guest joins", async ({ multi }) => {
    const { host, guest } = multi;

    await setTestUser(host, "Alice");
    await setTestUser(guest, "Bob");

    // Host creates room
    const code = await hostCreatesRoom(host);
    expect(code).toHaveLength(6);

    // Host sees the room code
    await expect(host.getByText(code)).toBeVisible();

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
    await expect(host.getByText("Bob")).toBeVisible({ timeout: 5000 });

    // Host selects pack
    await hostSelectsPack(host, "Pack Test");

    // Guest should see the pack selection
    await expect(guest.getByText("Pack Test")).toBeVisible({ timeout: 5000 });

    // Host selects mode
    await hostSelectsMode(host, "Classique");

    // Guest should see the mode selection
    await expect(guest.getByText("Classique")).toBeVisible({ timeout: 5000 });
  });

  test("guest cannot see host controls", async ({ multi }) => {
    const { host, guest } = multi;

    await setTestUser(host, "Alice");
    await setTestUser(guest, "Bob");

    const code = await hostCreatesRoom(host);
    await guestJoinsRoom(guest, code);

    await expect(host.getByText("Bob")).toBeVisible({ timeout: 5000 });

    // Host has "Lancer la partie" button
    await expect(
      host.getByRole("button", { name: /Lancer la partie/ }),
    ).toBeVisible();

    // Guest sees waiting message instead
    await expect(guest.getByText(/attente/i)).toBeVisible();
  });
});
