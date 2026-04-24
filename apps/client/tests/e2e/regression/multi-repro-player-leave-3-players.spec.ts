// Repro: when one of 3 players leaves mid-game, the other two should keep
// playing without visible breakage (stale rotation, orphan scores, stuck
// turn, etc.).
//
// Today: the server removes the player from `room.players` but
// `currentPlayerIndex` + UI state can drift out of sync, leading to a stuck
// turn or the leaver's username still appearing in the scoreboard.
//
// Expected: after the leave, the remaining two players stay on /game AND a
// new turn is playable — `p.text-xl` (the question) updates when one of them
// answers.

import { test as base } from "@playwright/test";
import {
  answerViaUI,
  guestJoinsRoom,
  hostCreatesRoom,
  hostSelectsMode,
  hostSelectsPack,
  sendAppWsMessage,
  setTestUser,
} from "../../helpers/multi-fixtures";

// Extend the default fixture to spawn three browser contexts.
const test = base.extend<{
  trio: {
    p1: import("@playwright/test").Page;
    p2: import("@playwright/test").Page;
    p3: import("@playwright/test").Page;
  };
}>({
  trio: async ({ browser }, use) => {
    const c1 = await browser.newContext();
    const c2 = await browser.newContext();
    const c3 = await browser.newContext();
    const p1 = await c1.newPage();
    const p2 = await c2.newPage();
    const p3 = await c3.newPage();

    // Mirror setupPage minus the fixture (routes + mocks handled lazily via
    // the same setup used by multi fixture). We reuse the mock-strapi global
    // server; only WS auth bypass needs page-level setup.
    const id = `${Date.now()}-trio`;
    for (const p of [p1, p2, p3]) {
      // biome-ignore lint/suspicious/noExplicitAny: test extension
      (p as any).__testId = id;
    }

    // Bypass Clerk + mock Strapi REST on each page (copied from multi fixture)
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = dirname(fileURLToPath(import.meta.url));
    const MOCKS_DIR = join(here, "..", "..", "mocks", "data");
    const loadMock = (f: string) => readFileSync(join(MOCKS_DIR, f), "utf-8");

    for (const p of [p1, p2, p3]) {
      await p.addInitScript(() => {
        (window as unknown as Record<string, unknown>).__clerk_test_bypass__ =
          true;
      });
      await p.route("**/clerk.*.com/v1/**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        }),
      );
      await p.route("**/.well-known/openid-configuration", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        }),
      );
      await p.route("**/*.mp3", (route) =>
        route.fulfill({ status: 200, contentType: "audio/mpeg", body: "" }),
      );
      await p.route("**/api/question-packs**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: loadMock("packs.json"),
        }),
      );
      await p.route("**/api/questions**", (route) => {
        const url = new URL(route.request().url());
        const slug =
          url.searchParams.get("filters[pack][slug][$eq]") ?? "pack-test";
        try {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: loadMock(`questions-${slug}.json`),
          });
        } catch {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: '{"data":[]}',
          });
        }
      });
      await p.route("**/api/player/**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { id: 1, username: "testuser" } }),
        }),
      );
    }

    await use({ p1, p2, p3 });

    await c1.close();
    await c2.close();
    await c3.close();
  },
});

test.describe("multi: 3 players, one leaves mid-game", () => {
  test("current player leaves — rotation advances so next turn fires", async ({
    trio,
  }) => {
    test.slow();
    const { p1, p2, p3 } = trio;

    await setTestUser(p1, "Alice");
    await setTestUser(p2, "Bob");
    await setTestUser(p3, "Charlie");

    const code = await hostCreatesRoom(p1);
    await guestJoinsRoom(p2, code);
    await guestJoinsRoom(p3, code);
    await p1.getByText("Bob", { exact: false }).waitFor({ timeout: 5000 });
    await p1.getByText("Charlie", { exact: false }).waitFor({ timeout: 5000 });

    await hostSelectsPack(p1, "pack-test");
    await hostSelectsMode(p1, "classic");
    await sendAppWsMessage(p1, { type: "start_game" });

    await Promise.all([
      p1.waitForURL("**/game", { timeout: 10000 }),
      p2.waitForURL("**/game", { timeout: 10000 }),
      p3.waitForURL("**/game", { timeout: 10000 }),
    ]);

    await p1.locator("p.text-xl").waitFor({ state: "visible", timeout: 10000 });
    const q1 = (await p1.locator("p.text-xl").textContent())?.trim() ?? "";

    // Rotation starts at index 0 → Alice (p1) is the current player.
    // Alice leaves before answering.
    await sendAppWsMessage(p1, { type: "leave_room" });

    // The stuck turn must resolve: the question text on the remaining
    // players must advance past q1 on its own (server forfeits Alice's
    // turn and schedules the next question).
    await p2.waitForFunction(
      (prev) => {
        const el = document.querySelector("p.text-xl");
        const txt = el?.textContent?.trim();
        return !!txt && txt !== prev;
      },
      q1,
      { timeout: 10000 },
    );
  });

  test("remaining 2 players keep playing, next turn still fires", async ({
    trio,
  }) => {
    test.slow();
    const { p1, p2, p3 } = trio;

    await setTestUser(p1, "Alice");
    await setTestUser(p2, "Bob");
    await setTestUser(p3, "Charlie");

    const code = await hostCreatesRoom(p1);
    await guestJoinsRoom(p2, code);
    await guestJoinsRoom(p3, code);

    await p1.getByText("Bob", { exact: false }).waitFor({ timeout: 5000 });
    await p1.getByText("Charlie", { exact: false }).waitFor({ timeout: 5000 });

    await hostSelectsPack(p1, "pack-test");
    await hostSelectsMode(p1, "classic");
    await sendAppWsMessage(p1, { type: "start_game" });

    await Promise.all([
      p1.waitForURL("**/game", { timeout: 10000 }),
      p2.waitForURL("**/game", { timeout: 10000 }),
      p3.waitForURL("**/game", { timeout: 10000 }),
    ]);

    await p1.locator("p.text-xl").waitFor({ state: "visible", timeout: 10000 });
    const firstQuestion =
      (await p1.locator("p.text-xl").textContent())?.trim() ?? "";

    // Charlie leaves.
    await sendAppWsMessage(p3, { type: "leave_room" });

    // The remaining two must stay on /game (no forced navigation) and their
    // scoreboard must drop Charlie.
    await p1.waitForTimeout(500);
    const url1 = p1.url();
    const url2 = p2.url();
    if (!url1.includes("/game") || !url2.includes("/game")) {
      throw new Error(
        `Remaining players navigated away unexpectedly: p1=${url1}, p2=${url2}`,
      );
    }

    // Play one turn — whoever is the current player answers.
    let answered = false;
    for (const p of [p1, p2]) {
      if (await answerViaUI(p)) {
        answered = true;
        break;
      }
    }
    if (!answered) {
      throw new Error("Neither remaining player could submit an answer");
    }

    // Question must advance — proves the rotation correctly skipped Charlie.
    await p1.waitForFunction(
      (prev) => {
        const el = document.querySelector("p.text-xl");
        const txt = el?.textContent?.trim();
        return !!txt && txt !== prev;
      },
      firstQuestion,
      { timeout: 10000 },
    );
  });
});
