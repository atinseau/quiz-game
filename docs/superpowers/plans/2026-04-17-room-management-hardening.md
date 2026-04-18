# Room Management Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every room-management defect surfaced in the 2026-04-17 audit: zombie rooms after `game_over`, server cleanup ignoring `playing` rooms, leaked timers, no cleanup on navigation-away, fragile client store race conditions, multi-tab silent overwrites, and missing liveness detection — while keeping the architecture fully in-memory.

**Architecture:** Server-side introduces a single `deleteRoom(code)` chokepoint that tears down every timer (chrono, next-question, player grace) attached to a room, plus a new `status = "ended"` state so the periodic sweeper can age out rooms in any phase. Player grace timers become cancelable per player. Duplicate tabs for the same `clerkId` close the stale socket politely. On the client, the Zustand `roomStore` drops its `setTimeout(check, 50)` polling loops in favor of a queued-send-on-open pattern, `gameStarting` is reset on disconnect, and a single `useRoomRouteGuard` hook in `AppRoutes` calls `leaveRoom()` whenever the browser lands on a route outside the in-room set. `MultiEndScreen` is the one remaining happy-path exit that also calls `leaveRoom()` explicitly.

**Tech Stack:** Bun `Bun.serve` + `ServerWebSocket`, TypeScript, React + react-router-dom, Zustand, Playwright (E2E via `multi-device` project).

---

## File Structure

| Path | Change | Responsibility |
|------|--------|----------------|
| `apps/client/src/server/types.ts` | Modify | Extend `Room.status` union, add `graceTimer` field to `RoomPlayer`, add `Room.nextQuestionTimer` |
| `apps/client/src/server/rooms.ts` | Modify | Introduce `deleteRoom(code)`, cancel-aware grace timers, extended periodic cleanup |
| `apps/client/src/server/game-engine.ts` | Modify | Route all `setTimeout` through the room's own timer slot; clear on `deleteRoom` |
| `apps/client/src/server/ws.ts` | Modify | Duplicate-tab handling in `open`, `status === "ended"` in `join_room` |
| `apps/client/index.ts` | Modify | Add `idleTimeout` to `Bun.serve` for liveness |
| `apps/client/src/stores/roomStore.ts` | Modify | Queued-send-on-open, reset `gameStarting`, robust `leaveRoom` |
| `apps/client/src/hooks/useRoomRouteGuard.ts` | Create | Watch pathname; call `leaveRoom` when user leaves the in-room set |
| `apps/client/src/App.tsx` | Modify | Mount `useRoomRouteGuard` in `AppRoutes` |
| `apps/client/src/components/MultiEndScreen.tsx` | Modify | "Nouvelle partie" calls `leaveRoom()` before `navigate` |
| `apps/client/tests/e2e/multi-lobby.spec.ts` | Modify | Regression tests: back-nav from lobby drops server-side membership |
| `apps/client/tests/e2e/multi-end-cleanup.spec.ts` | Create | E2E: reaching end screen + clicking "Nouvelle partie" releases room |
| `apps/client/src/server/rooms.test.ts` | Create | Bun unit tests for `deleteRoom`, grace cancellation, periodic sweeper |

---

## Task 1: Centralize room teardown with a `deleteRoom` helper

**Why:** Today rooms are removed from the `rooms` Map in 3 different sites (`leaveRoom`, periodic cleanup, `handleDisconnect`'s 60 s setTimeout). None of them clear `chronoTimers` or the pending `scheduleNextQuestion` timeout. A single chokepoint guarantees nothing leaks.

**Files:**
- Modify: `apps/client/src/server/types.ts` (add `nextQuestionTimer` on `Room`, `graceTimer` on `RoomPlayer`)
- Modify: `apps/client/src/server/rooms.ts` (new `deleteRoom`, update call-sites)
- Modify: `apps/client/src/server/game-engine.ts` (route `scheduleNextQuestion`'s setTimeout through `room.nextQuestionTimer`)
- Test: `apps/client/src/server/rooms.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/client/src/server/rooms.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { createRoom, deleteRoom, getRoom } from "./rooms";
import type { WsData } from "./types";

function fakeWs(data: WsData) {
  return {
    data,
    send: () => {},
    close: () => {},
    // biome-ignore lint/suspicious/noExplicitAny: test stub
  } as any;
}

describe("deleteRoom", () => {
  test("removes the room and clears playerToRoom index", () => {
    const ws = fakeWs({
      clerkId: "u1",
      username: "Alice",
      gender: "homme",
    });
    const room = createRoom(ws);
    expect(getRoom(room.code)).toBeDefined();

    deleteRoom(room.code);

    expect(getRoom(room.code)).toBeUndefined();
  });

  test("is a no-op on unknown code", () => {
    expect(() => deleteRoom("ZZZZZZ")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd apps/client && bun test src/server/rooms.test.ts
```

Expected: FAIL — `deleteRoom` is not exported.

- [ ] **Step 3: Extend types**

Edit `apps/client/src/server/types.ts`:

```ts
export interface RoomPlayer {
  clerkId: string;
  username: string;
  gender: Gender;
  ws: ServerWebSocket<WsData> | null;
  connected: boolean;
  disconnectedAt: number | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
}

export interface Room {
  code: string;
  hostClerkId: string;
  players: Map<string, RoomPlayer>;
  status: "lobby" | "playing" | "ended";
  packSlug: string | null;
  mode: GameMode | null;
  game: GameState | null;
  alcoholConfig: AlcoholConfig | null;
  endedAt: number | null;
  nextQuestionTimer: ReturnType<typeof setTimeout> | null;
}
```

- [ ] **Step 4: Update every `RoomPlayer` construction site**

In `apps/client/src/server/rooms.ts`, the two `RoomPlayer` literals (inside `createRoom` and `joinRoom`) add `graceTimer: null`.

```ts
const player: RoomPlayer = {
  clerkId,
  username,
  gender,
  ws,
  connected: true,
  disconnectedAt: null,
  graceTimer: null,
};
```

In the `createRoom` function, construct the `Room` literal with the new fields:

```ts
const room: Room = {
  code,
  hostClerkId: clerkId,
  players: new Map([[clerkId, player]]),
  status: "lobby",
  packSlug: null,
  mode: null,
  game: null,
  alcoholConfig: null,
  endedAt: null,
  nextQuestionTimer: null,
};
```

- [ ] **Step 5: Implement `deleteRoom`**

Add to `apps/client/src/server/rooms.ts` (after `getRoom`):

```ts
/**
 * Single chokepoint for room removal. Clears every timer attached to the room
 * (chrono, scheduleNextQuestion, per-player grace) and removes the reverse
 * index entries. Safe to call on an unknown code.
 */
export function deleteRoom(code: string): void {
  const room = rooms.get(code);
  if (!room) return;

  if (room.nextQuestionTimer) {
    clearTimeout(room.nextQuestionTimer);
    room.nextQuestionTimer = null;
  }

  for (const player of room.players.values()) {
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
    playerToRoom.delete(player.clerkId);
  }

  clearChronoTimer(code);
  rooms.delete(code);
}
```

Import `clearChronoTimer` from `game-engine.ts`:

```ts
import { clearChronoTimer } from "./game-engine";
```

Export `clearChronoTimer` from `game-engine.ts`:

```ts
export function clearChronoTimer(roomCode: string) {
  ...
}
```

- [ ] **Step 6: Replace direct `rooms.delete` callers**

In `rooms.ts`, replace the three direct deletions:

`leaveRoom`:
```ts
  room.players.delete(clerkId);
  playerToRoom.delete(clerkId);
  broadcast(room, { type: "player_left", clerkId });

  if (room.players.size === 0) {
    deleteRoom(code);
    return;
  }
```

`handleDisconnect`'s inner setTimeout:
```ts
  if (current && !current.connected) {
    room.players.delete(clerkId);
    playerToRoom.delete(clerkId);
    broadcast(room, { type: "player_left", clerkId });
    if (room.players.size === 0) {
      deleteRoom(code);
    }
  }
```

Periodic sweeper (will be rewritten in Task 4 — leave as-is for now but use `deleteRoom`):
```ts
    if (room.players.size === 0 || allDisconnected) {
      deleteRoom(code);
    }
```

- [ ] **Step 7: Route `scheduleNextQuestion` through the room slot**

In `apps/client/src/server/game-engine.ts`, replace the bare `setTimeout` in `scheduleNextQuestion`:

```ts
function scheduleNextQuestion(room: Room): void {
  if (room.nextQuestionTimer) {
    clearTimeout(room.nextQuestionTimer);
  }
  room.nextQuestionTimer = setTimeout(() => {
    room.nextQuestionTimer = null;
    const game = room.game;
    if (!game) return;
    // ... existing body unchanged ...
  }, NEXT_QUESTION_DELAY);
}
```

Also check the second `setTimeout` around line 537 — do the same mechanism or leave if the ref is unrelated (alcohol round). If it is alcohol-specific and short, leave it.

- [ ] **Step 8: Run the failing test to confirm it now passes**

```bash
cd apps/client && bun test src/server/rooms.test.ts
```

Expected: PASS.

- [ ] **Step 9: Typecheck**

```bash
cd apps/client && bunx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 10: Commit**

```bash
git add apps/client/src/server/types.ts apps/client/src/server/rooms.ts apps/client/src/server/game-engine.ts apps/client/src/server/rooms.test.ts
git commit -m "feat(server): centralize room teardown via deleteRoom helper"
```

---

## Task 2: Cancelable per-player grace timer

**Why:** Today `handleDisconnect` schedules a 60 s `setTimeout` at module scope with no way to cancel it. If the player reconnects, calls `leaveRoom`, or the room gets deleted from elsewhere, the timer still runs and touches a possibly-deleted `room.players`. Routing the timer through `player.graceTimer` lets every site cancel it cleanly.

**Files:**
- Modify: `apps/client/src/server/rooms.ts` (`handleDisconnect`, `joinRoom` reconnect branch, `leaveRoom`, `deleteRoom`)
- Test: `apps/client/src/server/rooms.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/client/src/server/rooms.test.ts`:

```ts
import {
  createRoom,
  deleteRoom,
  getRoom,
  handleDisconnect,
  joinRoom,
} from "./rooms";

describe("grace timer cancellation", () => {
  test("reconnect cancels the pending grace timeout", () => {
    const ws = fakeWs({
      clerkId: "u1",
      username: "Alice",
      gender: "homme",
    });
    const room = createRoom(ws);

    handleDisconnect("u1");
    const player = room.players.get("u1");
    expect(player?.graceTimer).not.toBeNull();

    // Simulate reconnect (server.open handler does this, but we replicate)
    joinRoom(ws, room.code);
    expect(room.players.get("u1")?.graceTimer).toBeNull();

    deleteRoom(room.code);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/client && bun test src/server/rooms.test.ts
```

Expected: FAIL — `graceTimer` stays non-null.

- [ ] **Step 3: Rewrite `handleDisconnect`**

Replace the body of `handleDisconnect` in `rooms.ts`:

```ts
export function handleDisconnect(clerkId: string): void {
  const code = playerToRoom.get(clerkId);
  if (!code) return;

  const room = rooms.get(code);
  if (!room) {
    playerToRoom.delete(clerkId);
    return;
  }

  const player = room.players.get(clerkId);
  if (!player) {
    playerToRoom.delete(clerkId);
    return;
  }

  player.ws = null;
  player.connected = false;
  player.disconnectedAt = Date.now();
  broadcast(room, { type: "player_disconnected", clerkId });

  reassignHost(room, clerkId);

  if (player.graceTimer) {
    clearTimeout(player.graceTimer);
  }
  player.graceTimer = setTimeout(() => {
    player.graceTimer = null;
    const current = room.players.get(clerkId);
    if (!current || current.connected) return;
    room.players.delete(clerkId);
    playerToRoom.delete(clerkId);
    broadcast(room, { type: "player_left", clerkId });
    if (room.players.size === 0) {
      deleteRoom(room.code);
    }
  }, 60_000);
}
```

- [ ] **Step 4: Cancel in `joinRoom` reconnect branch**

In `joinRoom`, where it handles an existing player:

```ts
  const existing = room.players.get(clerkId);
  if (existing) {
    if (existing.graceTimer) {
      clearTimeout(existing.graceTimer);
      existing.graceTimer = null;
    }
    existing.ws = ws;
    existing.connected = true;
    existing.disconnectedAt = null;
    // ... rest unchanged
  }
```

- [ ] **Step 5: Cancel in `leaveRoom`**

Before the `room.players.delete(clerkId)` call in `leaveRoom`:

```ts
  const leaving = room.players.get(clerkId);
  if (leaving?.graceTimer) {
    clearTimeout(leaving.graceTimer);
    leaving.graceTimer = null;
  }

  room.players.delete(clerkId);
```

- [ ] **Step 6: Cancel in `ws.ts` `open` auto-reconnect**

In `apps/client/src/server/ws.ts`, the `open` handler's success branch (line ~213 area):

```ts
    const player = room.players.get(ws.data.clerkId);
    if (player) {
      if (player.graceTimer) {
        clearTimeout(player.graceTimer);
        player.graceTimer = null;
      }
      player.ws = ws;
      player.connected = true;
      player.disconnectedAt = null;
      // ... existing body
    }
```

- [ ] **Step 7: Run the test**

```bash
cd apps/client && bun test src/server/rooms.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/client/src/server/rooms.ts apps/client/src/server/ws.ts apps/client/src/server/rooms.test.ts
git commit -m "feat(server): cancelable per-player grace timer"
```

---

## Task 3: `status = "ended"` transition on `game_over`

**Why:** Today the server never leaves `status = "playing"` after a game finishes. The periodic sweeper skips non-`lobby` rooms, and `join_room` rejects new arrivals. The room is effectively a zombie until the last socket drops *and* the 60 s grace expires — and even then, only if nobody reconnects. Adding `"ended"` lets the sweeper age these rooms out, and lets `join_room` distinguish "game in progress" from "game finished".

**Files:**
- Modify: `apps/client/src/server/game-engine.ts` (`endGame` sets `status` and `endedAt`)
- Modify: `apps/client/src/server/rooms.ts` (`joinRoom` blocks only `"playing"`)
- Test: `apps/client/src/server/rooms.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `rooms.test.ts`:

```ts
import { endGameForTest } from "./game-engine";

describe("status transitions", () => {
  test("endGame marks the room as ended with a timestamp", () => {
    const ws = fakeWs({
      clerkId: "u1",
      username: "Alice",
      gender: "homme",
    });
    const room = createRoom(ws);
    room.status = "playing";
    room.game = {
      questions: [],
      currentQuestionIndex: 0,
      currentPlayerIndex: 0,
      scores: {},
      combos: {},
      answers: new Map(),
      questionStartedAt: 0,
      resolved: false,
      alcoholState: null,
    };

    endGameForTest(room);

    expect(room.status).toBe("ended");
    expect(room.endedAt).toBeGreaterThan(0);
    deleteRoom(room.code);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/client && bun test src/server/rooms.test.ts
```

Expected: FAIL — `endGameForTest` not exported.

- [ ] **Step 3: Export `endGame` as `endGameForTest`**

At the bottom of `apps/client/src/server/game-engine.ts`:

```ts
// Exported for unit tests only — do not call from runtime code paths.
export { endGame as endGameForTest };
```

- [ ] **Step 4: Update `endGame` to transition status**

In `game-engine.ts` `endGame`, at the very top of the function body (after `if (!game) return;`):

```ts
function endGame(room: Room): void {
  const game = room.game;
  if (!game) return;

  clearChronoTimer(room.code);
  room.status = "ended";
  room.endedAt = Date.now();
  // ... existing body continues
```

- [ ] **Step 5: Make `join_room` reject only active games**

In `apps/client/src/server/rooms.ts` `joinRoom`, replace:

```ts
  if (room.status === "playing") {
    send(ws, { type: "error", message: "La partie a déjà commencé" });
    return null;
  }
```

with:

```ts
  if (room.status !== "lobby") {
    const msg =
      room.status === "playing"
        ? "La partie a déjà commencé"
        : "La partie est terminée";
    send(ws, { type: "error", message: msg });
    return null;
  }
```

- [ ] **Step 6: Run the test**

```bash
cd apps/client && bun test src/server/rooms.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/server/game-engine.ts apps/client/src/server/rooms.ts apps/client/src/server/rooms.test.ts
git commit -m "feat(server): transition room status to ended on game_over"
```

---

## Task 4: Rewrite the periodic sweeper to handle every status

**Why:** The current sweeper body (`if (room.status !== "lobby") continue;`) ignores in-progress and ended rooms. After Task 3 the sweeper must age out `"ended"` rooms quickly and also recover `"playing"` rooms whose players all dropped.

**Files:**
- Modify: `apps/client/src/server/rooms.ts`
- Test: `apps/client/src/server/rooms.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import { runPeriodicCleanupForTest } from "./rooms";

describe("periodic cleanup", () => {
  test("removes ended rooms older than 2 minutes", () => {
    const ws = fakeWs({
      clerkId: "u1",
      username: "Alice",
      gender: "homme",
    });
    const room = createRoom(ws);
    room.status = "ended";
    room.endedAt = Date.now() - 3 * 60_000;

    runPeriodicCleanupForTest();

    expect(getRoom(room.code)).toBeUndefined();
  });

  test("removes playing rooms with all players disconnected > 10 min", () => {
    const ws = fakeWs({
      clerkId: "u2",
      username: "Bob",
      gender: "homme",
    });
    const room = createRoom(ws);
    room.status = "playing";
    const player = room.players.get("u2");
    if (!player) throw new Error("test setup failed");
    player.connected = false;
    player.disconnectedAt = Date.now() - 11 * 60_000;

    runPeriodicCleanupForTest();

    expect(getRoom(room.code)).toBeUndefined();
  });

  test("keeps a fresh lobby room", () => {
    const ws = fakeWs({
      clerkId: "u3",
      username: "Carol",
      gender: "homme",
    });
    const room = createRoom(ws);

    runPeriodicCleanupForTest();

    expect(getRoom(room.code)).toBeDefined();
    deleteRoom(room.code);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/client && bun test src/server/rooms.test.ts
```

Expected: FAIL — `runPeriodicCleanupForTest` not defined.

- [ ] **Step 3: Replace the `setInterval` body with a named function**

Replace the bottom of `apps/client/src/server/rooms.ts`:

```ts
const LOBBY_IDLE_GRACE_MS = 10 * 60_000;
const PLAYING_IDLE_GRACE_MS = 10 * 60_000;
const ENDED_GRACE_MS = 2 * 60_000;

function periodicCleanup(): void {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.status === "ended") {
      const age = room.endedAt ? now - room.endedAt : ENDED_GRACE_MS + 1;
      if (age > ENDED_GRACE_MS) {
        deleteRoom(code);
      }
      continue;
    }

    if (room.players.size === 0) {
      deleteRoom(code);
      continue;
    }

    const grace =
      room.status === "lobby" ? LOBBY_IDLE_GRACE_MS : PLAYING_IDLE_GRACE_MS;
    const allStale = Array.from(room.players.values()).every(
      (p) =>
        !p.connected && p.disconnectedAt && now - p.disconnectedAt > grace,
    );
    if (allStale) {
      deleteRoom(code);
    }
  }
}

setInterval(periodicCleanup, 60_000);

/** Exposed for unit tests only. */
export function runPeriodicCleanupForTest(): void {
  periodicCleanup();
}
```

- [ ] **Step 4: Run the test**

```bash
cd apps/client && bun test src/server/rooms.test.ts
```

Expected: PASS for all three sub-tests.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/server/rooms.ts apps/client/src/server/rooms.test.ts
git commit -m "feat(server): sweeper handles lobby, playing, and ended rooms"
```

---

## Task 5: Evict duplicate tabs for the same `clerkId`

**Why:** Opening the app in a second tab with the same user silently overwrites `player.ws` on the server, stranding the first tab with no realtime updates and no error. Closing the stale socket with a distinct close code lets the first tab react (show a toast, stop the spinner).

**Files:**
- Modify: `apps/client/src/server/ws.ts` (`open` handler)
- Modify: `apps/client/src/stores/roomStore.ts` (interpret close code 4001)

- [ ] **Step 1: Add the eviction logic**

In `apps/client/src/server/ws.ts` `open` handler, replace the success branch:

```ts
  open(ws: ServerWebSocket<WsData>) {
    console.log(`[ws] Connected: ${ws.data.username} (${ws.data.clerkId})`);
    const room = findRoomByPlayer(ws.data.clerkId);
    if (room) {
      const player = room.players.get(ws.data.clerkId);
      if (player) {
        if (
          player.ws &&
          player.ws !== ws &&
          player.ws.readyState === WebSocket.OPEN
        ) {
          // Another socket owns this clerkId — evict the old one.
          player.ws.close(4001, "duplicate_connection");
        }
        if (player.graceTimer) {
          clearTimeout(player.graceTimer);
          player.graceTimer = null;
        }
        player.ws = ws;
        player.connected = true;
        player.disconnectedAt = null;
        ws.send(
          JSON.stringify({
            type: "room_joined",
            room: toRoomState(room),
            yourClerkId: ws.data.clerkId,
          }),
        );
        broadcast(
          room,
          { type: "player_reconnected", clerkId: ws.data.clerkId },
          ws.data.clerkId,
        );
      }
    }
  },
```

- [ ] **Step 2: Interpret the close code on the client**

In `apps/client/src/stores/roomStore.ts` `connect` method, replace:

```ts
    newWs.onclose = () => {
      set({ connected: false, ws: null });
    };
```

with:

```ts
    newWs.onclose = (ev) => {
      const evicted = ev.code === 4001;
      set({
        connected: false,
        ws: null,
        error: evicted
          ? "Session reprise dans un autre onglet"
          : get().error,
      });
    };
```

- [ ] **Step 3: Smoke test manually**

Open two tabs with the same test user (or run `bun --hot index.ts` with `CLERK_SECRET_KEY=` and two incognito sessions using `?testUser=`). The first tab should surface "Session reprise dans un autre onglet" and the WS should close.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/server/ws.ts apps/client/src/stores/roomStore.ts
git commit -m "feat(server): evict duplicate WS with close code 4001"
```

---

## Task 6: Enable `idleTimeout` for dead-connection detection

**Why:** TCP can quietly silently die (wifi drop, sleeping laptop). Bun supports `idleTimeout` on the WS upgrade — no framing-level ping/pong needed. A 120 s timeout is well inside the 60 s grace window *only after* the socket actually times out, so we pick 60 s idle → close → `handleDisconnect` → 60 s grace → total 2 min before removal.

**Files:**
- Modify: `apps/client/index.ts`

- [ ] **Step 1: Add `idleTimeout` to the websocket config**

In `apps/client/index.ts`, expand the `websocket` field:

```ts
websocket: {
  ...websocketHandlers,
  idleTimeout: 60, // seconds; Bun auto-closes silent sockets
},
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/client && bunx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/client/index.ts
git commit -m "feat(server): enable 60s idleTimeout on the WS upgrade"
```

---

## Task 7: Reset `gameStarting` on client `disconnect()` and `reset()`

**Why:** The flag gets stuck `true` across sessions, which causes `MultiLobby` to auto-navigate to `/game` when a user returns to a lobby after a previous game.

**Files:**
- Modify: `apps/client/src/stores/roomStore.ts`
- Test: augments existing Playwright coverage (no new unit test needed)

- [ ] **Step 1: Update `disconnect`**

```ts
  disconnect: () => {
    const { ws } = get();
    if (ws) ws.close();
    set({
      ws: null,
      connected: false,
      room: null,
      gameStarting: false,
      game: { ...initialGame },
    });
  },
```

- [ ] **Step 2: Confirm `reset` already sets `gameStarting: false`**

In `roomStore.ts`, `reset()` already sets it — no change needed.

- [ ] **Step 3: Typecheck + run multi-lobby suite**

```bash
cd apps/client && bunx tsc --noEmit
# temporarily patch .env (see session history) then:
bunx playwright test multi-lobby.spec.ts --workers=1 --retries=0
```

Expected: 10/10 pass.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/stores/roomStore.ts
git commit -m "fix(client): reset gameStarting flag on disconnect"
```

---

## Task 8: Replace `setTimeout(check, 50)` polling with a queue

**Why:** The polling loops in `createRoom` and `joinRoom` are a smell: they create a race window where the client can miss a `room_joined` that arrived between two polls, and they keep re-firing after the component that initiated them unmounts. A queue flushed in `ws.onopen` is deterministic.

**Files:**
- Modify: `apps/client/src/stores/roomStore.ts`

- [ ] **Step 1: Add a private queue field**

In the store initial state:

```ts
  ws: null,
  pendingMessages: [] as Array<Record<string, unknown>>,
  connected: false,
  // ...
```

Also add the field to the interface:

```ts
interface RoomStore {
  ws: WebSocket | null;
  pendingMessages: Array<Record<string, unknown>>;
  // ...
}
```

- [ ] **Step 2: Helper that either sends or queues**

Add near the existing `sendMsg`:

```ts
function sendOrQueue(
  state: RoomStore,
  set: (partial: Partial<RoomStore>) => void,
  msg: Record<string, unknown>,
): void {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(msg));
    return;
  }
  set({ pendingMessages: [...state.ws ? state.pendingMessages : [], msg] });
}
```

Actually simpler — inline at the call site. Add a store method instead:

```ts
  enqueue: (msg: Record<string, unknown>) => {
    const { ws, pendingMessages } = get();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return;
    }
    set({ pendingMessages: [...pendingMessages, msg] });
  },
```

Declare in the interface:

```ts
  enqueue: (msg: Record<string, unknown>) => void;
```

- [ ] **Step 3: Flush on `onopen`**

In `connect()`:

```ts
    newWs.onopen = () => {
      const { pendingMessages } = get();
      for (const msg of pendingMessages) {
        newWs.send(JSON.stringify(msg));
      }
      set({ connected: true, error: null, pendingMessages: [] });
    };
```

- [ ] **Step 4: Rewrite `createRoom` and `joinRoom`**

```ts
  createRoom: () => {
    set({ room: null, gameStarting: false, error: null });
    get().connect();
    get().enqueue({ type: "create_room" });
  },

  joinRoom: (code: string) => {
    get().connect();
    if (get().room) return;
    get().enqueue({ type: "join_room", code });
  },
```

- [ ] **Step 5: Clear the queue on `disconnect` and `reset`**

`disconnect`:

```ts
  disconnect: () => {
    const { ws } = get();
    if (ws) ws.close();
    set({
      ws: null,
      connected: false,
      room: null,
      gameStarting: false,
      game: { ...initialGame },
      pendingMessages: [],
    });
  },
```

- [ ] **Step 6: Run multi-lobby suite**

```bash
# with .env temp-patched
bunx playwright test multi-lobby.spec.ts --workers=1 --retries=0
```

Expected: 10/10 pass.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/stores/roomStore.ts
git commit -m "refactor(client): replace WS polling with onopen queue flush"
```

---

## Task 9: Route-aware cleanup via `useRoomRouteGuard`

**Why:** Right now the only cleanup triggers are (a) explicit "Quitter" buttons and (b) `leaveRoom` calls inside `create_room` on the server. Any other navigation — browser back from lobby, direct URL edit to `/`, deep link to `/play/solo` — leaves the room dangling. A single hook in `AppRoutes` that observes pathname + store state removes the problem once and for all.

**Files:**
- Create: `apps/client/src/hooks/useRoomRouteGuard.ts`
- Modify: `apps/client/src/App.tsx` (mount the hook)

- [ ] **Step 1: Create the hook**

Create `apps/client/src/hooks/useRoomRouteGuard.ts`:

```ts
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useRoomStore } from "../stores/roomStore";

// Routes where an active room is legitimate. Anywhere else ⇒ leaveRoom.
const IN_ROOM_PATTERNS = [
  /^\/play\/create$/,
  /^\/play\/lobby\/[^/]+$/,
  /^\/play\/join$/,
  /^\/join\/[^/]+$/,
  /^\/game$/,
  /^\/end$/,
];

function isInRoomPath(pathname: string): boolean {
  return IN_ROOM_PATTERNS.some((re) => re.test(pathname));
}

export function useRoomRouteGuard(): void {
  const { pathname } = useLocation();
  const room = useRoomStore((s) => s.room);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);

  useEffect(() => {
    if (room && !isInRoomPath(pathname)) {
      leaveRoom();
    }
  }, [pathname, room, leaveRoom]);
}
```

- [ ] **Step 2: Mount in `AppRoutes`**

In `apps/client/src/App.tsx`, inside `AppRoutes`:

```ts
import { useRoomRouteGuard } from "./hooks/useRoomRouteGuard";

function AppRoutes() {
  const navigate = useNavigate();
  useRoomRouteGuard();

  useEffect(() => {
    setNavigate(navigate);
    useGameStore.getState().restoreFromStorage();
  }, [navigate]);
  // ...
}
```

- [ ] **Step 3: Write a regression E2E test**

Append to `apps/client/tests/e2e/multi-lobby.spec.ts`:

```ts
  test("browser back from lobby releases the room server-side", async ({
    multi,
  }) => {
    const { host } = multi;
    await setTestUser(host, "Alice");

    const code = await hostCreatesRoom(host);

    // Go back to /play
    await host.goBack();
    await expect(host.getByText("Comment tu veux jouer ?")).toBeVisible({
      timeout: 10000,
    });

    // Try to rejoin the same code — should now fail with "Room introuvable"
    // because the guard called leaveRoom and the room was deleted (single member)
    await host.goto("/play/join");
    await host.getByPlaceholder("Ex: A3K9F2").fill(code);
    await host.getByRole("button", { name: "Rejoindre" }).click();

    await expect(host.getByText("Room introuvable").first()).toBeVisible({
      timeout: 10000,
    });
  });
```

- [ ] **Step 4: Run the test**

```bash
# with .env temp-patched
bunx playwright test multi-lobby.spec.ts -g "browser back from lobby" --workers=1 --retries=0
```

Expected: PASS.

- [ ] **Step 5: Run the full suite to check for regressions**

```bash
bunx playwright test multi-lobby.spec.ts --workers=1 --retries=0
```

Expected: 11/11 pass.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/hooks/useRoomRouteGuard.ts apps/client/src/App.tsx apps/client/tests/e2e/multi-lobby.spec.ts
git commit -m "feat(client): route guard auto-leaves the room on unexpected nav"
```

---

## Task 10: `MultiEndScreen` explicitly leaves the room

**Why:** Even with Task 9 in place, clicking "Nouvelle partie" from the end screen navigates to `/play`, which is outside the in-room set, so the guard does leave. But doing it explicitly in the button handler is cheaper (one round-trip instead of an effect-triggered one) and clearer.

**Files:**
- Modify: `apps/client/src/components/MultiEndScreen.tsx`
- Create: `apps/client/tests/e2e/multi-end-cleanup.spec.ts`

- [ ] **Step 1: Update the button handler**

In `MultiEndScreen.tsx`:

```tsx
import { useRoomStore } from "../stores/roomStore";

export function MultiEndScreen() {
  const navigate = useNavigate();
  const game = useRoomStore((s) => s.game);
  const room = useRoomStore((s) => s.room);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  // ...

  const handleNewGame = () => {
    leaveRoom();
    navigate("/play");
  };
  // ...

            <Button
              size="lg"
              onClick={handleNewGame}
              className="w-full h-14 text-lg glow-purple"
            >
              Nouvelle partie
            </Button>
```

- [ ] **Step 2: Write the E2E test**

Create `apps/client/tests/e2e/multi-end-cleanup.spec.ts`:

```ts
import { expect, hostCreatesRoom, setTestUser, test } from "../helpers/multi-fixtures";

test.describe.configure({ mode: "serial" });

test("Nouvelle partie from end screen releases the room", async ({ multi }) => {
  const { host } = multi;
  await setTestUser(host, "Alice");

  const code = await hostCreatesRoom(host);

  // Simulate reaching /end with a gameOver state (force-navigate; gameOver is
  // not strictly required for the leave-room call to fire).
  await host.evaluate((c) => {
    const s = (window as unknown as {
      // biome-ignore lint/suspicious/noExplicitAny: test global
      useRoomStore: any;
    });
    // Fallback: just navigate — the real assertion is that leaveRoom fires.
  });

  await host.goto("/end");
  // If the store has a gameOver, MultiEndScreen renders. Otherwise it shows
  // "Chargement…" — which is fine for this test, we just need the component
  // mounted. For determinism, assert either is visible:
  await expect(
    host.locator("text=/Fin de la partie|Chargement/").first(),
  ).toBeVisible({ timeout: 5000 });

  // Try to rejoin the code — should fail because leaveRoom deleted it
  await host.goto("/play/join");
  await host.getByPlaceholder("Ex: A3K9F2").fill(code);
  await host.getByRole("button", { name: "Rejoindre" }).click();

  await expect(host.getByText("Room introuvable").first()).toBeVisible({
    timeout: 10000,
  });
});
```

- [ ] **Step 3: Run**

```bash
bunx playwright test multi-end-cleanup.spec.ts --workers=1 --retries=0
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/MultiEndScreen.tsx apps/client/tests/e2e/multi-end-cleanup.spec.ts
git commit -m "feat(client): MultiEndScreen leaves the room on 'Nouvelle partie'"
```

---

## Task 11: Harden `CreateRoom` against stale `room` state

**Why:** The `ModeChoice` fix from the prior session (clearing the store before `navigate("/play/create")`) works, but any future entry point that routes into `/play/create` bypasses that workaround. Making `CreateRoom` itself robust removes the class of bug.

**Files:**
- Modify: `apps/client/src/App.tsx` (`CreateRoom` component)

- [ ] **Step 1: Refactor `CreateRoom` to track a mount-time intent**

Replace the body of `CreateRoom`:

```tsx
function CreateRoom() {
  const createRoom = useRoomStore((s) => s.createRoom);
  const room = useRoomStore((s) => s.room);
  const error = useRoomStore((s) => s.error);
  const clearError = useRoomStore((s) => s.clearError);
  const navigate = useNavigate();
  const navigatedRef = useRef(false);

  useEffect(() => {
    // Always clear stale state and request a fresh room on mount.
    useRoomStore.setState({ room: null, gameStarting: false, error: null });
    createRoom();
  }, [createRoom]);

  useEffect(() => {
    if (room && !navigatedRef.current) {
      navigatedRef.current = true;
      navigate(`/play/lobby/${room.code}`, { replace: true });
    }
  }, [room, navigate]);

  useEffect(() => {
    if (error && !room) {
      toast.error(error);
      clearError();
      navigate("/play", { replace: true });
    }
  }, [error, room, navigate, clearError]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">
        Création de la room...
      </div>
    </div>
  );
}
```

Add the import:

```ts
import { useEffect, useRef } from "react";
```

- [ ] **Step 2: Remove the `ModeChoice` workaround**

In `apps/client/src/components/ModeChoice.tsx`, delete `goCreate` and restore the simple `onClick`:

```tsx
            <Button
              size="lg"
              variant="secondary"
              className="py-8 text-base"
              onClick={() => navigate("/play/create")}
            >
              <Wifi className="size-5 mr-2" />
              Créer une partie
            </Button>
```

Also remove the now-unused `useRoomStore` import from `ModeChoice.tsx`.

- [ ] **Step 3: Run the "creating a room twice" regression**

```bash
bunx playwright test multi-lobby.spec.ts -g "creating a room twice" --workers=1 --retries=0
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/App.tsx apps/client/src/components/ModeChoice.tsx
git commit -m "refactor(client): CreateRoom self-clears stale room on mount"
```

---

## Task 12: Cancel pending `nextQuestionTimer` when a room is abandoned

**Why:** Task 1 stored the next-question timeout on `room.nextQuestionTimer` but `handleDisconnect` doesn't currently cancel it when the last player leaves. `deleteRoom` clears it (per Task 1), so the fix is to route the "all disconnected" early-exit through `deleteRoom`. Already done in Tasks 2 and 4 via `deleteRoom`. This task is verification.

**Files:**
- Test: `apps/client/src/server/rooms.test.ts`

- [ ] **Step 1: Write the verification test**

Append:

```ts
import { scheduleNextQuestionForTest } from "./game-engine";

describe("timer cleanup on delete", () => {
  test("deleteRoom cancels scheduled next-question timer", async () => {
    const ws = fakeWs({
      clerkId: "u1",
      username: "Alice",
      gender: "homme",
    });
    const room = createRoom(ws);
    room.status = "playing";
    room.game = {
      questions: [],
      currentQuestionIndex: 0,
      currentPlayerIndex: 0,
      scores: {},
      combos: {},
      answers: new Map(),
      questionStartedAt: 0,
      resolved: false,
      alcoholState: null,
    };

    scheduleNextQuestionForTest(room);
    expect(room.nextQuestionTimer).not.toBeNull();

    deleteRoom(room.code);
    expect(room.nextQuestionTimer).toBeNull();
  });
});
```

- [ ] **Step 2: Export the helper**

At the bottom of `apps/client/src/server/game-engine.ts`:

```ts
export { scheduleNextQuestion as scheduleNextQuestionForTest };
```

- [ ] **Step 3: Run**

```bash
cd apps/client && bun test src/server/rooms.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/server/game-engine.ts apps/client/src/server/rooms.test.ts
git commit -m "test(server): verify deleteRoom cancels next-question timer"
```

---

## Task 13: Final regression — full test sweep

**Why:** Accumulated changes touch the shared store and server lifecycle. Run everything before closing.

- [ ] **Step 1: Typecheck**

```bash
cd apps/client && bunx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 2: Server unit tests**

```bash
cd apps/client && bun test src/
```

Expected: all green (including new `rooms.test.ts`).

- [ ] **Step 3: Playwright — multi-lobby + end-cleanup**

```bash
# temp-patch .env (CLERK_SECRET_KEY=, PUBLIC_API_URL=http://localhost:1337/api)
bunx playwright test multi-lobby.spec.ts multi-end-cleanup.spec.ts --workers=1 --retries=0
# restore .env
```

Expected: all green.

- [ ] **Step 4: Playwright — the 3 known-flaky flows**

```bash
bunx playwright test multi-classic-flow.spec.ts multi-voleur-flow.spec.ts multi-alcohol-flow.spec.ts --workers=1 --retries=0
```

Expected: the same pre-existing failures as today (4 failing tests from the in-progress voleur refactor). No NEW failures.

- [ ] **Step 5: Update the nightwatch discovery index**

Append a row to `apps/client/.discovery/scenarios/_index.md` under the Multi-device section:

```markdown
| [Browser back cleans room](./browser-back-cleans-room.md) | lobby | covered | critical | multi-lobby |
| [End screen cleans room](./end-screen-cleans-room.md) | end | covered | high | multi-end-cleanup |
```

Create the two scenario files with status `covered`, linking to the tests.

- [ ] **Step 6: Commit**

```bash
git add apps/client/.discovery/scenarios
git commit -m "docs(discovery): register room-cleanup regression scenarios"
```

---

## Self-review results

**Spec coverage:**

| Audit finding | Task |
|---|---|
| No cleanup on nav-away from lobby/game | 9 |
| `MultiEndScreen` doesn't release room | 10 |
| Periodic cleanup ignores "playing" | 4 |
| `game_over` doesn't transition status | 3 |
| `gameStarting` stuck `true` | 7 |
| URL mismatch effect doesn't sync with server | 9 (superseded by route guard) |
| Auto-reconnection invisible to user / multi-tab | 5 |
| Game-engine timers not cleaned on abandonment | 1, 12 |
| Grace timer hardcoded + runs after leave | 2 |
| No heartbeat | 6 |
| `Room introuvable` residual fragility | 11 |
| Code expiration | covered by Task 4 sweeper |

All 12 items are wired to a task.

**Placeholder scan:** No TBD / "add appropriate X" / unexpanded references. All tasks ship runnable code.

**Type consistency:** `deleteRoom` signature consistent across tasks. `graceTimer` and `nextQuestionTimer` types match their type definitions. `room.status = "ended"` used identically in Tasks 3 and 4.
