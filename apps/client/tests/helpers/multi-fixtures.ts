/**
 * Fixtures for multi-device E2E tests.
 * Creates two browser contexts (two players) with mocked Clerk + Strapi.
 * WS is real — connects via ?testUser= fallback (no CLERK_SECRET_KEY in test).
 */
import {
  type BrowserContext,
  test as base,
  expect,
  type Page,
} from "@playwright/test";

async function setupPage(page: Page) {
  // Bypass AuthGuard
  await page.addInitScript(() => {
    (window as any).__clerk_test_bypass__ = true;
  });

  // Mock Clerk endpoints
  await page.route("**/clerk.*.com/v1/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    }),
  );

  await page.route("**/.well-known/openid-configuration", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    }),
  );

  // Mock audio files
  await page.route("**/*.mp3", (route) =>
    route.fulfill({ status: 200, contentType: "audio/mpeg", body: "" }),
  );
}

interface MultiPlayers {
  host: Page;
  guest: Page;
  hostContext: BrowserContext;
  guestContext: BrowserContext;
}

export const test = base.extend<{ multi: MultiPlayers }>({
  multi: async ({ browser }, use) => {
    // Create two separate browser contexts (two different players)
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    await setupPage(host);
    await setupPage(guest);

    await use({ host, guest, hostContext, guestContext });

    await hostContext.close();
    await guestContext.close();
  },
});

export { expect };

/**
 * Override the WebSocket URL to include testUser param for WS auth bypass.
 * Call this BEFORE navigating to any page that opens a WS.
 */
export async function setTestUser(page: Page, username: string) {
  await page.addInitScript((name) => {
    const OriginalWebSocket = window.WebSocket;
    (window as any).WebSocket = class extends OriginalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const wsUrl = new URL(url.toString());
        wsUrl.searchParams.set("testUser", name);
        super(wsUrl.toString(), protocols);
      }
    };
  }, username);
}

/**
 * Host creates a room and returns the room code.
 */
export async function hostCreatesRoom(host: Page): Promise<string> {
  await host.goto("/play");
  await host.getByRole("button", { name: /Créer une partie/ }).click();

  // Wait for lobby to load with room code
  await host.waitForURL("**/play/lobby/**");

  // Extract room code from URL
  const url = host.url();
  const code = url.split("/play/lobby/")[1];
  if (!code) throw new Error("Room code not found in URL");
  return code;
}

/**
 * Guest joins a room by code.
 */
export async function guestJoinsRoom(guest: Page, code: string) {
  await guest.goto("/play/join");
  await guest.getByPlaceholder("Ex: A3K9F2").fill(code);
  await guest.getByRole("button", { name: "Rejoindre" }).click();

  // Wait for lobby
  await guest.waitForURL(`**/play/lobby/${code}`);
}

/**
 * Host selects a pack in the lobby.
 */
export async function hostSelectsPack(host: Page, packName: string) {
  await host.getByRole("button", { name: new RegExp(packName) }).click();
}

/**
 * Host selects a game mode in the lobby.
 */
export async function hostSelectsMode(host: Page, modeName: string) {
  await host.getByRole("button", { name: new RegExp(modeName) }).click();
}

/**
 * Host starts the game.
 */
export async function hostStartsGame(host: Page) {
  await host.getByRole("button", { name: "Lancer la partie" }).click();
}
