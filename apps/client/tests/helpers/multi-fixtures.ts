/**
 * Fixtures for multi-device E2E tests.
 * Creates two browser contexts (two players) with mocked Clerk + Strapi.
 * WS is real — connects via ?testUser= fallback (no CLERK_SECRET_KEY in test).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type BrowserContext,
  test as base,
  expect,
  type Page,
} from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCKS_DIR = join(__dirname, "..", "mocks", "data");

function loadMock(filename: string): string {
  return readFileSync(join(MOCKS_DIR, filename), "utf-8");
}

async function setupPage(page: Page) {
  // Bypass AuthGuard
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__clerk_test_bypass__ = true;
  });

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

  // Mock Strapi endpoints
  const packsData = loadMock("packs.json");
  await page.route("**/api/question-packs**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: packsData,
    }),
  );

  await page.route("**/api/questions**", (route) => {
    const url = new URL(route.request().url());
    const slug =
      url.searchParams.get("filters[pack][slug][$eq]") ?? "pack-test";
    try {
      const data = loadMock(`questions-${slug}.json`);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: data,
      });
    } catch {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"data":[]}',
      });
    }
  });

  await page.route("**/api/player/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { id: 1, username: "testuser" } }),
    }),
  );
}

interface MultiPlayers {
  host: Page;
  guest: Page;
  hostContext: BrowserContext;
  guestContext: BrowserContext;
}

// Counter to generate unique usernames across parallel test runs
let testCounter = 0;

export const test = base.extend<{ multi: MultiPlayers }>({
  multi: async ({ browser }, use) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    // Generate unique IDs to avoid WS conflicts when tests run in parallel
    const id = `${Date.now()}-${++testCounter}`;
    // biome-ignore lint/suspicious/noExplicitAny: Playwright page extension
    (host as any).__testId = id;
    // biome-ignore lint/suspicious/noExplicitAny: Playwright page extension
    (guest as any).__testId = id;

    await setupPage(host);
    await setupPage(guest);

    await use({ host, guest, hostContext, guestContext });

    await hostContext.close();
    await guestContext.close();
  },
});

export { expect };

/**
 * Try to answer the current question on a given page via UI interaction.
 * Uses force:true to bypass Bun HMR overlay that can intercept pointer events.
 * Returns true if an answer was submitted.
 */
export async function answerViaUI(page: Page): Promise<boolean> {
  // QCM: grid buttons
  const qcmBtns = page.locator(".grid button");
  const qcmCount = await qcmBtns.count().catch(() => 0);
  if (qcmCount > 0) {
    const firstBtn = qcmBtns.first();
    if (await firstBtn.isEnabled({ timeout: 500 }).catch(() => false)) {
      await firstBtn.click({ force: true });
      return true;
    }
  }

  // VF: Vrai/Faux buttons
  const vraiBtn = page.getByRole("button", { name: "Vrai", exact: true });
  if (await vraiBtn.isVisible({ timeout: 300 }).catch(() => false)) {
    if (await vraiBtn.isEnabled({ timeout: 200 }).catch(() => false)) {
      await vraiBtn.click({ force: true });
      return true;
    }
  }

  // Texte: input field
  const texteInput = page.getByPlaceholder("Votre réponse...");
  if (await texteInput.isVisible({ timeout: 300 }).catch(() => false)) {
    if (await texteInput.isEnabled({ timeout: 200 }).catch(() => false)) {
      await texteInput.fill("Paris");
      await texteInput.press("Enter");
      return true;
    }
  }

  return false;
}

/**
 * Override the WebSocket URL to include testUser param for WS auth bypass.
 * Call this BEFORE navigating to any page that opens a WS.
 */
export async function setTestUser(page: Page, username: string) {
  // biome-ignore lint/suspicious/noExplicitAny: Playwright page extension
  const testId = (page as any).__testId ?? "";
  const uniqueName = testId ? `${username}-${testId}` : username;
  // Store the unique name for later use in helpers
  // biome-ignore lint/suspicious/noExplicitAny: Playwright page extension
  (page as any).__testUserName = uniqueName;

  await page.addInitScript((name: string) => {
    const OriginalWebSocket = window.WebSocket;
    // biome-ignore lint/suspicious/noExplicitAny: test global
    (window as any).__OriginalWebSocket = OriginalWebSocket;

    /**
     * Override WebSocket to inject testUser param and suppress redundant
     * join_room messages that occur during component navigation (CreateRoom
     * -> MultiLobby, JoinRoom -> MultiLobby).
     *
     * We track the current room code from room_joined events. Join_room
     * messages for the SAME code are suppressed (race: server auto-reconnect
     * already put us in that room). Join_room for a DIFFERENT code is a
     * legitimate URL-change transition and must go through.
     */
    // Code of the room the client is currently in (from last room_joined).
    // Null until joined, or after create_room is sent (new room pending).
    let currentRoomCode: string | null = null;
    let joinRoomTimer: ReturnType<typeof setTimeout> | null = null;
    const normalizeCode = (c: unknown) =>
      typeof c === "string" ? c.toUpperCase() : null;

    // biome-ignore lint/suspicious/noExplicitAny: test global
    (window as any).WebSocket = class extends OriginalWebSocket {
      private _sentCreate = false;

      constructor(url: string | URL, protocols?: string | string[]) {
        const wsUrl = new URL(url.toString());
        wsUrl.searchParams.set("testUser", name);
        super(wsUrl.toString(), protocols);

        // Track the most recently opened WS for use by test helpers
        // biome-ignore lint/suspicious/noExplicitAny: test global
        (window as any).__testActiveWs = this;

        this.addEventListener("message", (evt: Event) => {
          try {
            const data = JSON.parse((evt as MessageEvent).data);
            if (data.type === "room_joined") {
              currentRoomCode = normalizeCode(data.room?.code);
              // Cancel any pending delayed join_room
              if (joinRoomTimer) {
                clearTimeout(joinRoomTimer);
                joinRoomTimer = null;
              }
            }
          } catch {}
        });
      }

      override send(
        data: string | ArrayBufferLike | Blob | ArrayBufferView,
      ): void {
        if (typeof data === "string") {
          try {
            const msg = JSON.parse(data);
            if (msg.type === "create_room") {
              this._sentCreate = true;
              currentRoomCode = null;
            }
            // For join_room (not after explicit create_room):
            // 1. If already in the SAME room, suppress (component re-mount race)
            // 2. Otherwise delay 300ms to let server auto-reconnect first,
            //    then re-check before sending
            if (msg.type === "join_room" && !this._sentCreate) {
              const newCode = normalizeCode(msg.code);
              if (currentRoomCode !== null && currentRoomCode === newCode) {
                return;
              }
              // Only schedule one delayed join_room at a time
              if (!joinRoomTimer) {
                joinRoomTimer = setTimeout(() => {
                  joinRoomTimer = null;
                  if (currentRoomCode !== null && currentRoomCode === newCode) {
                    return;
                  }
                  const activeWs = // biome-ignore lint/suspicious/noExplicitAny: test global
                    (window as any).__testActiveWs;
                  if (activeWs?.readyState === WebSocket.OPEN) {
                    OriginalWebSocket.prototype.send.call(
                      activeWs,
                      JSON.stringify(msg),
                    );
                  }
                }, 300);
              }
              return;
            }
          } catch {}
        }
        super.send(data);
      }
    };
  }, uniqueName);
}

/**
 * Send a WS message through the app's active WebSocket connection.
 * Uses the __testActiveWs reference tracked by the WS override.
 */
async function sendAppWsMessage(
  page: Page,
  message: Record<string, unknown>,
): Promise<void> {
  const result = await page.evaluate((msg) => {
    const ws = // biome-ignore lint/suspicious/noExplicitAny: test global
      (window as any).__testActiveWs as WebSocket | undefined;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return { error: `No active WS (state: ${ws?.readyState ?? "none"})` };
    }
    // Use the original send to bypass our override's suppression
    const OrigWs = // biome-ignore lint/suspicious/noExplicitAny: test global
      (window as any).__OriginalWebSocket;
    OrigWs.prototype.send.call(ws, JSON.stringify(msg));
    return { ok: true };
  }, message);
  if (result && "error" in result) {
    console.log(`[sendAppWsMessage] Warning: ${result.error}`);
  }
}

/**
 * Host creates a room and returns the room code.
 */
export async function hostCreatesRoom(host: Page): Promise<string> {
  await host.goto("/play");
  await host.getByRole("button", { name: /Créer une partie/ }).click();

  // Wait for lobby to load with room code
  await host.waitForURL("**/play/lobby/**", { timeout: 15000 });

  // Extract room code from URL
  const url = host.url();
  const code = url.split("/play/lobby/")[1];
  if (!code) throw new Error("Room code not found in URL");

  // Wait for MultiLobby to establish its WS connection and display the room
  await host.getByText("Code de la room").waitFor({ timeout: 10000 });

  return code;
}

/**
 * Guest joins a room by code.
 */
export async function guestJoinsRoom(guest: Page, code: string) {
  await guest.goto("/play/join");
  await guest.getByPlaceholder("Ex: A3K9F2").fill(code);
  await guest.getByRole("button", { name: "Rejoindre" }).click();

  // Wait for lobby — use networkidle to handle SPA routing under load
  await guest.waitForURL(`**/play/lobby/${code}`, {
    timeout: 15000,
    waitUntil: "domcontentloaded",
  });
  await guest.getByText("Code de la room").waitFor({ timeout: 10000 });
}

/**
 * Host selects a pack in the lobby via WebSocket message.
 * In test mode, useAuth().userId is null so isHost is always false.
 * The host sees the non-host view without pack/mode buttons.
 * We send the WS message directly to configure the room.
 */
export async function hostSelectsPack(host: Page, packSlug: string) {
  await sendAppWsMessage(host, { type: "select_pack", packSlug });
}

/**
 * Host selects a game mode in the lobby via WebSocket message.
 */
export async function hostSelectsMode(host: Page, mode: string) {
  await sendAppWsMessage(host, { type: "select_mode", mode });
}

/**
 * Host starts the game via WebSocket message.
 */
export async function hostStartsGame(host: Page) {
  await sendAppWsMessage(host, { type: "start_game" });
}

/**
 * Submit an answer via WebSocket (bypasses UI input detection).
 */
export async function submitAnswerViaWs(page: Page, answer: string | boolean) {
  await sendAppWsMessage(page, { type: "submit_answer", answer });
}

/**
 * Canonical locator for the current question text. Centralizes the
 * `p.text-xl` CSS pattern used across multi specs so a future markup change
 * needs a single edit.
 */
export function questionText(page: Page) {
  return page.locator("p.text-xl");
}

/**
 * Full multi-device game setup: identify users, create room, join, configure,
 * start, and wait for both devices to land on /game with the first question
 * visible. Consolidates the boilerplate shared across multi-classic, multi-chrono,
 * multi-voleur, and alcohol-multi specs.
 */
export async function startMultiGame(
  multi: { host: Page; guest: Page },
  opts: {
    mode: "classic" | "chrono" | "voleur";
    pack?: string;
    hostName?: string;
    guestName?: string;
  },
): Promise<string> {
  const { host, guest } = multi;
  await setTestUser(host, opts.hostName ?? "Alice");
  await setTestUser(guest, opts.guestName ?? "Bob");

  const code = await hostCreatesRoom(host);
  await guestJoinsRoom(guest, code);
  await expect(host.getByText(opts.guestName ?? "Bob")).toBeVisible({
    timeout: 5000,
  });

  await hostSelectsPack(host, opts.pack ?? "pack-test");
  await hostSelectsMode(host, opts.mode);
  await hostStartsGame(host);

  await host.waitForURL("**/game", { timeout: 10000 });
  await guest.waitForURL("**/game", { timeout: 10000 });
  await expect(questionText(host)).toBeVisible({ timeout: 10000 });

  return code;
}
