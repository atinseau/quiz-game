// Repro: when the 2nd player leaves a multi game, the game must end for the
// remaining player — a 1-player "multi" game isn't playable and leaves the
// host stuck on /game with broken rotation / score UI.
//
// Today: the server broadcasts `player_left` and shrinks `room.players`, but
// nothing ends the game. The remaining player stays on /game indefinitely.
//
// Expected: remaining player is navigated off /game (to /play) within a
// short window, with room/game state cleared.

import {
  guestJoinsRoom,
  hostCreatesRoom,
  hostSelectsMode,
  hostSelectsPack,
  sendAppWsMessage,
  setTestUser,
  test,
} from "../../helpers/multi-fixtures";

test.describe("multi: 2 players, one leaves mid-game", () => {
  test("remaining player is sent back to /play and game is torn down", async ({
    multi,
  }) => {
    test.slow();
    const { host, guest } = multi;

    await setTestUser(host, "Alice");
    await setTestUser(guest, "Bob");

    const code = await hostCreatesRoom(host);
    await guestJoinsRoom(guest, code);
    await host.getByText("Bob", { exact: false }).waitFor({ timeout: 5000 });

    await hostSelectsPack(host, "pack-test");
    await hostSelectsMode(host, "classic");
    await sendAppWsMessage(host, { type: "start_game" });

    await host.waitForURL("**/game", { timeout: 10000 });
    await guest.waitForURL("**/game", { timeout: 10000 });
    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 });

    // Guest leaves mid-game.
    await sendAppWsMessage(guest, { type: "leave_room" });

    // Host must be pulled off /game — no second player means no game left
    // to play. Accept either /play (multi home) or / (landing).
    await host.waitForURL(/\/(play|$)/, { timeout: 8000 });
  });
});
