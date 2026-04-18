# Code Quality Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate duplicated types, remove unsafe casts, type the WS message handler, extract shared utilities, and add a reverse index for room lookups — all without changing any feature behavior.

**Architecture:** Create a shared types module imported by both server and client. Extract scoring/shuffle into shared utilities. Type the WS handler with `ServerMessage`. Add a `playerToRoom` reverse index in rooms.ts. Remove all unnecessary `as` casts. Extract duplicated host-change logic.

**Tech Stack:** TypeScript, Zustand, Bun WebSocket server

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/client/src/shared/types.ts` | Create | Shared types: PlayerResult, TurnResult, RankingEntry, PlayerInfo, RoomState, QuestionWithoutAnswer, Gender, ServerMessage |
| `apps/client/src/shared/scoring.ts` | Create | Shared utilities: shuffle, clampCombo |
| `apps/client/src/server/types.ts` | Modify | Remove types moved to shared, re-export from shared, keep server-only types (Room, GameState, WsData, RoomPlayer, ClientMessage) |
| `apps/client/src/stores/roomStore.ts` | Modify | Import types from shared instead of local defs, type WS handler with ServerMessage |
| `apps/client/src/server/game-engine.ts` | Modify | Remove `as` casts, use shared shuffle, proper undefined narrowing |
| `apps/client/src/server/ws.ts` | Modify | Remove redundant `as` casts |
| `apps/client/src/server/rooms.ts` | Modify | Add playerToRoom reverse index, extract reassignHost helper |
| `apps/client/src/stores/gameStore.ts` | Modify | Use shared shuffle |
| `apps/client/src/types.ts` | Modify | Remove duplicate Gender, import from shared |

---

### Task 1: Create shared types module

**Files:**
- Create: `apps/client/src/shared/types.ts`

- [ ] **Step 1: Create the shared types file**

```ts
// apps/client/src/shared/types.ts
// Shared types used by both server and client code.
// Server-only types (Room, GameState, WsData, RoomPlayer, ClientMessage) stay in server/types.ts.

import type { GameMode } from "../types";
import type { SpecialRoundType } from "../server/alcohol/types";

export type Gender = "homme" | "femme";

export interface QuestionWithoutAnswer {
  type: "qcm" | "vrai_faux" | "texte";
  text: string;
  choices?: string[];
  category: string;
}

export interface PlayerResult {
  clerkId: string;
  answered: boolean;
  correct: boolean;
  stole: boolean;
  pointsDelta: number;
}

export interface TurnResult {
  correctAnswer: string | boolean;
  playerResults: PlayerResult[];
  scores: Record<string, number>;
  combos: Record<string, number>;
}

export interface RankingEntry {
  clerkId: string;
  username: string;
  score: number;
  rank: number;
}

export interface PlayerInfo {
  clerkId: string;
  username: string;
  gender: Gender;
  connected: boolean;
}

export interface RoomState {
  code: string;
  hostClerkId: string;
  players: PlayerInfo[];
  status: "lobby" | "playing";
  packSlug: string | null;
  mode: GameMode | null;
}

export type ServerMessage =
  | { type: "room_created"; code: string }
  | { type: "room_joined"; room: RoomState; yourClerkId: string }
  | { type: "player_joined"; player: PlayerInfo }
  | { type: "player_left"; clerkId: string }
  | { type: "player_disconnected"; clerkId: string }
  | { type: "player_reconnected"; clerkId: string }
  | { type: "host_changed"; clerkId: string }
  | {
      type: "player_updated";
      clerkId: string;
      username: string;
      gender: Gender;
    }
  | { type: "pack_selected"; packSlug: string }
  | { type: "mode_selected"; mode: GameMode }
  | { type: "game_starting" }
  | { type: "error"; message: string }
  | {
      type: "question";
      index: number;
      currentPlayerClerkId: string;
      question: QuestionWithoutAnswer;
      startsAt: number;
    }
  | { type: "player_answered"; clerkId: string }
  | { type: "turn_result"; results: TurnResult }
  | {
      type: "game_over";
      scores: Record<string, number>;
      rankings: RankingEntry[];
    }
  | {
      type: "special_round_start";
      roundType: SpecialRoundType;
      data: Record<string, unknown>;
    }
  | {
      type: "drink_alert";
      targetClerkId: string;
      emoji: string;
      message: string;
    }
  | { type: "courage_decision"; playerClerkId: string; countdown: number }
  | { type: "courage_question"; question: QuestionWithoutAnswer }
  | { type: "courage_result"; correct: boolean; pointsDelta: number }
  | { type: "distribute_prompt"; distributorClerkId: string; remaining: number }
  | { type: "special_round_end" }
  | {
      type: "conseil_result";
      votes: Record<string, string>;
      loserClerkIds: string[];
    }
  | {
      type: "show_us_result";
      correctColor: string | null;
      wrongClerkIds: string[];
      timedOut?: boolean;
    }
  | {
      type: "love_or_drink_result";
      choice: "bisou" | "cul_sec";
      players: { clerkId: string; username: string }[];
    }
  | {
      type: "smatch_or_pass_result";
      decideur: { clerkId: string; username: string; gender: string };
      receveur: { clerkId: string; username: string; gender: string };
      choice: "smatch" | "pass";
    };
```

- [ ] **Step 2: Run type check**

Run: `bun --filter '*' check-types`
Expected: PASS (new file, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shared/types.ts
git commit -m "refactor: create shared types module for server/client reuse"
```

---

### Task 2: Migrate server/types.ts to re-export from shared

**Files:**
- Modify: `apps/client/src/server/types.ts`

- [ ] **Step 1: Replace duplicated types with re-exports**

In `apps/client/src/server/types.ts`, remove the local definitions of `Gender`, `QuestionWithoutAnswer`, `PlayerResult`, `TurnResult`, `RankingEntry`, `PlayerInfo`, `RoomState`, `ServerMessage` and replace them with re-exports from shared. Keep server-only types (`WsData`, `RoomPlayer`, `QuestionFull`, `GameState`, `Room`, `ClientMessage`) in place.

The file should become:

```ts
import type { ServerWebSocket } from "bun";
import type { GameMode } from "../types";
import type {
  AlcoholConfig,
  AlcoholState,
} from "./alcohol/types";

// Re-export shared types so existing server imports keep working
export type {
  Gender,
  PlayerInfo,
  PlayerResult,
  QuestionWithoutAnswer,
  RankingEntry,
  RoomState,
  ServerMessage,
  TurnResult,
} from "../shared/types";

import type { Gender } from "../shared/types";
import type { QuestionWithoutAnswer } from "../shared/types";

export interface WsData {
  clerkId: string;
  username: string;
  gender: Gender;
}

export interface RoomPlayer {
  clerkId: string;
  username: string;
  gender: Gender;
  ws: ServerWebSocket<WsData> | null;
  connected: boolean;
  disconnectedAt: number | null;
}

// --- Game Engine Types ---

export interface QuestionFull extends QuestionWithoutAnswer {
  answer: string;
}

export interface GameState {
  questions: QuestionFull[];
  currentQuestionIndex: number;
  currentPlayerIndex: number;
  scores: Record<string, number>;
  combos: Record<string, number>;
  answers: Map<string, string | boolean>;
  questionStartedAt: number;
  resolved: boolean;
  alcoholState: AlcoholState | null;
}

export interface Room {
  code: string;
  hostClerkId: string;
  players: Map<string, RoomPlayer>;
  status: "lobby" | "playing";
  packSlug: string | null;
  mode: GameMode | null;
  game: GameState | null;
  alcoholConfig: AlcoholConfig | null;
}

export type ClientMessage =
  | { type: "create_room" }
  | { type: "join_room"; code: string }
  | { type: "select_pack"; packSlug: string }
  | { type: "select_mode"; mode: GameMode }
  | { type: "start_game"; alcoholConfig?: AlcoholConfig }
  | { type: "leave_room" }
  | { type: "update_nickname"; nickname: string }
  | { type: "update_gender"; gender: Gender }
  | { type: "submit_answer"; answer: string | boolean }
  | { type: "courage_choice"; accept: boolean }
  | { type: "courage_answer"; answer: string | boolean }
  | { type: "distribute_drink"; targetClerkId: string }
  | { type: "conseil_vote"; targetClerkId: string }
  | { type: "love_or_drink_choice"; choice: "bisou" | "cul_sec" }
  | { type: "show_us_vote"; color: string }
  | { type: "show_us_reveal"; color: string }
  | { type: "smatch_choice"; choice: "smatch" | "pass" };
```

- [ ] **Step 2: Run type check**

Run: `bun --filter '*' check-types`
Expected: PASS — all existing imports from `server/types` still resolve via re-exports.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/server/types.ts
git commit -m "refactor: server/types re-exports shared types, removes duplicates"
```

---

### Task 3: Migrate roomStore.ts to use shared types + type the WS handler

**Files:**
- Modify: `apps/client/src/stores/roomStore.ts`

- [ ] **Step 1: Replace local type definitions with imports from shared**

Remove the local `PlayerInfo`, `QuestionData`, `PlayerResult`, `TurnResult`, `RankingEntry` interfaces (lines 9-52). Import from shared instead. Also import `ServerMessage` and type the WS `onmessage` handler.

At the top of the file, replace:

```ts
import { create } from "zustand";
import type { GameMode } from "../types";
import { sounds } from "../utils/sounds";
import type { AlcoholConfig } from "./alcoholStore";
import { useAlcoholStore } from "./alcoholStore";

// --- Types ---

export interface PlayerInfo {
  clerkId: string;
  username: string;
  gender: "homme" | "femme";
  connected: boolean;
}

export interface RoomState {
  code: string;
  hostClerkId: string;
  players: PlayerInfo[];
  status: "lobby" | "playing";
  packSlug: string | null;
  mode: GameMode | null;
}

export interface QuestionData {
  type: "qcm" | "vrai_faux" | "texte";
  text: string;
  choices?: string[];
  category: string;
}

export interface PlayerResult {
  clerkId: string;
  answered: boolean;
  correct: boolean;
  stole: boolean;
  pointsDelta: number;
}

export interface TurnResult {
  correctAnswer: string | boolean;
  playerResults: PlayerResult[];
  scores: Record<string, number>;
  combos: Record<string, number>;
}

export interface RankingEntry {
  clerkId: string;
  username: string;
  score: number;
  rank: number;
}
```

With:

```ts
import { create } from "zustand";
import type {
  PlayerInfo,
  PlayerResult,
  QuestionWithoutAnswer,
  RankingEntry,
  RoomState,
  ServerMessage,
  TurnResult,
} from "../shared/types";
import type { GameMode } from "../types";
import { sounds } from "../utils/sounds";
import type { AlcoholConfig } from "./alcoholStore";
import { useAlcoholStore } from "./alcoholStore";

// Re-export for consumers that import from roomStore
export type { PlayerInfo, RankingEntry, RoomState, TurnResult };
```

- [ ] **Step 2: Rename QuestionData references to QuestionWithoutAnswer**

In the `GameState` interface inside roomStore, change:

```ts
question: QuestionData | null;
```

to:

```ts
question: QuestionWithoutAnswer | null;
```

- [ ] **Step 3: Type the WS onmessage handler**

In the `onmessage` handler (line 152), change:

```ts
const msg = JSON.parse(event.data);
```

to:

```ts
const msg: ServerMessage = JSON.parse(event.data);
```

- [ ] **Step 4: Run type check**

Run: `bun --filter '*' check-types`
Expected: PASS — the `ServerMessage` discriminated union already covers all `msg.type` cases in the switch. If any case accesses a field not on the union variant, TypeScript will now catch it.

- [ ] **Step 5: Run biome**

Run: `bunx biome check apps/client/src/stores/roomStore.ts`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/stores/roomStore.ts
git commit -m "refactor: roomStore uses shared types, WS handler typed with ServerMessage"
```

---

### Task 4: Create shared scoring utilities

**Files:**
- Create: `apps/client/src/shared/scoring.ts`

- [ ] **Step 1: Create the shared scoring module**

```ts
// apps/client/src/shared/scoring.ts
import { MAX_COMBO } from "../types";

/** Fisher-Yates shuffle (returns new array). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j]!;
    a[j] = tmp!;
  }
  return a;
}

/** Increment combo, clamped to MAX_COMBO. */
export function clampCombo(current: number): number {
  return Math.min(current + 1, MAX_COMBO);
}
```

- [ ] **Step 2: Run type check**

Run: `bun --filter '*' check-types`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shared/scoring.ts
git commit -m "refactor: extract shared shuffle and clampCombo utilities"
```

---

### Task 5: Use shared shuffle in game-engine.ts + remove unsafe casts

**Files:**
- Modify: `apps/client/src/server/game-engine.ts`

- [ ] **Step 1: Replace local shuffle with shared import**

Replace:

```ts
import {
  CHRONO_DURATION,
  CHRONO_TIMEOUT_PENALTY,
  MAX_COMBO,
  STEAL_FAIL_PENALTY,
  STEAL_GAIN,
  STEAL_LOSS,
} from "../types";
```

with:

```ts
import { shuffle } from "../shared/scoring";
import {
  CHRONO_DURATION,
  CHRONO_TIMEOUT_PENALTY,
  MAX_COMBO,
  STEAL_FAIL_PENALTY,
  STEAL_GAIN,
  STEAL_LOSS,
} from "../types";
```

Then delete the local `shuffle` function (lines 35-43).

- [ ] **Step 2: Remove unsafe `as string | boolean` casts**

In `resolveClassicOrChrono` (around line 280), replace:

```ts
const answer = game.answers.get(pid);
const correct = checkAnswer(answer as string | boolean, question);
```

with:

```ts
const answer = game.answers.get(pid);
if (answer === undefined) return;
const correct = checkAnswer(answer, question);
```

In `resolveVoleur`, for the main answer (around line 327), replace:

```ts
const mainAnswer = game.answers.get(mainPlayerId);
const mainCorrect = checkAnswer(mainAnswer as string | boolean, question);
```

with:

```ts
const mainAnswer = game.answers.get(mainPlayerId);
if (mainAnswer === undefined) return;
const mainCorrect = checkAnswer(mainAnswer, question);
```

In the stealer loop (around line 369), replace:

```ts
if (ans !== undefined && checkAnswer(ans as string | boolean, question)) {
```

with:

```ts
if (ans !== undefined && checkAnswer(ans, question)) {
```

- [ ] **Step 3: Run type check**

Run: `bun --filter '*' check-types`
Expected: PASS — `checkAnswer` accepts `string | boolean`, and after the undefined guard, `answer` is narrowed to `string | boolean`.

- [ ] **Step 4: Run biome**

Run: `bunx biome check apps/client/src/server/game-engine.ts`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/server/game-engine.ts
git commit -m "refactor: game-engine uses shared shuffle, removes unsafe as casts"
```

---

### Task 6: Use shared shuffle in gameStore.ts

**Files:**
- Modify: `apps/client/src/stores/gameStore.ts`

- [ ] **Step 1: Replace inline Fisher-Yates with shared shuffle**

Add import at the top:

```ts
import { shuffle } from "../shared/scoring";
```

In `startGame` (around line 212-218), replace:

```ts
// Shuffle all questions (Fisher-Yates)
for (let i = questions.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  const tmp = questions[i];
  questions[i] = questions[j] as Question;
  questions[j] = tmp as Question;
}
```

with:

```ts
const shuffled = shuffle(questions);
// Mutate in place since fetchPackQuestions returned a fresh array
questions.length = 0;
questions.push(...shuffled);
```

Also in `randomizeQuestion` (lines 24-36), replace:

```ts
function randomizeQuestion(questions: Question[], idx: number): void {
  if (idx >= questions.length) return;
  const q = questions[idx];
  if (!q?.choices) return;
  const arr = [...q.choices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j] as string;
    arr[j] = tmp as string;
  }
  questions[idx] = { ...q, choices: arr };
}
```

with:

```ts
function randomizeQuestion(questions: Question[], idx: number): void {
  if (idx >= questions.length) return;
  const q = questions[idx];
  if (!q?.choices) return;
  questions[idx] = { ...q, choices: shuffle(q.choices) };
}
```

- [ ] **Step 2: Run type check + tests**

Run: `bun --filter '*' check-types && bun --filter '*' test`
Expected: PASS — shuffle returns the same type array.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/stores/gameStore.ts
git commit -m "refactor: gameStore uses shared shuffle, removes inline Fisher-Yates"
```

---

### Task 7: Remove redundant casts in ws.ts

**Files:**
- Modify: `apps/client/src/server/ws.ts`

- [ ] **Step 1: Remove redundant `as string` and `as Record<string, unknown>` casts**

In the `update_nickname` case (around line 60), replace:

```ts
const nickname = (msg.nickname as string)?.trim();
```

with:

```ts
const nickname = msg.nickname.trim();
```

In the `update_gender` case (around line 87), replace:

```ts
const gender = msg.gender as string;
if (gender !== "homme" && gender !== "femme") {
```

with:

```ts
const { gender } = msg;
if (gender !== "homme" && gender !== "femme") {
```

In the alcohol message cases (around line 195), replace:

```ts
handleAlcoholMessage(room, clerkId, msg as Record<string, unknown>);
```

with:

```ts
handleAlcoholMessage(room, clerkId, msg);
```

This requires updating the `handleAlcoholMessage` signature in `apps/client/src/server/alcohol/framework.ts`. Check its current signature first — if it takes `Record<string, unknown>`, change it to accept `ClientMessage`:

```ts
// In alcohol/framework.ts, update the import and parameter type:
import type { ClientMessage } from "../types";

export function handleAlcoholMessage(
  room: Room,
  clerkId: string,
  msg: ClientMessage,
): void {
```

- [ ] **Step 2: Run type check**

Run: `bun --filter '*' check-types`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/server/ws.ts apps/client/src/server/alcohol/framework.ts
git commit -m "refactor: remove redundant as casts in ws.ts, type alcohol handler"
```

---

### Task 8: Add playerToRoom reverse index in rooms.ts + extract reassignHost

**Files:**
- Modify: `apps/client/src/server/rooms.ts`

- [ ] **Step 1: Add the reverse index and reassignHost helper**

At the top of rooms.ts, after `const rooms = new Map<string, Room>();`, add:

```ts
/** Reverse index: clerkId → room code for O(1) lookups. */
const playerToRoom = new Map<string, string>();
```

Extract the host-reassignment logic into a helper. After `toRoomState`, add:

```ts
function reassignHost(room: Room, oldHostId: string): void {
  if (room.hostClerkId !== oldHostId) return;
  const nextHost = Array.from(room.players.values()).find(
    (p) => p.connected,
  );
  if (nextHost) {
    room.hostClerkId = nextHost.clerkId;
    broadcast(room, { type: "host_changed", clerkId: nextHost.clerkId });
  }
}
```

- [ ] **Step 2: Update createRoom to maintain the index**

In `createRoom`, after `rooms.set(code, room);`, add:

```ts
playerToRoom.set(clerkId, code);
```

- [ ] **Step 3: Update joinRoom to maintain the index**

In `joinRoom`, after `room.players.set(clerkId, player);` (new player case), add:

```ts
playerToRoom.set(clerkId, code);
```

(Where `code` comes from `room.code` — use `room.code` since the `code` param may be lowercase. Actually the function already uppercases it via `rooms.get(code.toUpperCase())`, so use `room.code`.)

Also for the existing player reconnect path, the index should already be set, so no change needed.

- [ ] **Step 4: Update leaveRoom to maintain the index + use reassignHost**

Replace the entire `leaveRoom` function:

```ts
export function leaveRoom(clerkId: string): void {
  const code = playerToRoom.get(clerkId);
  if (!code) return;

  const room = rooms.get(code);
  if (!room || !room.players.has(clerkId)) {
    playerToRoom.delete(clerkId);
    return;
  }

  room.players.delete(clerkId);
  playerToRoom.delete(clerkId);
  broadcast(room, { type: "player_left", clerkId });

  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }

  reassignHost(room, clerkId);
}
```

- [ ] **Step 5: Update handleDisconnect to maintain the index + use reassignHost**

Replace the entire `handleDisconnect` function:

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

  setTimeout(() => {
    const current = room.players.get(clerkId);
    if (current && !current.connected) {
      room.players.delete(clerkId);
      playerToRoom.delete(clerkId);
      broadcast(room, { type: "player_left", clerkId });
      if (room.players.size === 0) {
        rooms.delete(code);
      }
    }
  }, 60_000);
}
```

- [ ] **Step 6: Update findRoomByPlayer to use the index**

Replace:

```ts
export function findRoomByPlayer(clerkId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.has(clerkId)) return room;
  }
  return undefined;
}
```

with:

```ts
export function findRoomByPlayer(clerkId: string): Room | undefined {
  const code = playerToRoom.get(clerkId);
  if (!code) return undefined;
  return rooms.get(code);
}
```

- [ ] **Step 7: Update stale room cleanup to clear the reverse index**

In the `setInterval` cleanup (bottom of file), after `rooms.delete(code);`, add index cleanup:

```ts
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.status !== "lobby") continue;
    const allDisconnected = Array.from(room.players.values()).every(
      (p) =>
        !p.connected &&
        p.disconnectedAt &&
        now - p.disconnectedAt > 10 * 60_000,
    );
    if (room.players.size === 0 || allDisconnected) {
      for (const id of room.players.keys()) {
        playerToRoom.delete(id);
      }
      rooms.delete(code);
    }
  }
}, 5 * 60_000);
```

- [ ] **Step 8: Run type check + tests**

Run: `bun --filter '*' check-types && bun --filter '*' test`
Expected: PASS

- [ ] **Step 9: Run biome**

Run: `bunx biome check apps/client/src/server/rooms.ts`
Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add apps/client/src/server/rooms.ts
git commit -m "refactor: add playerToRoom reverse index for O(1) lookups, extract reassignHost"
```

---

### Task 9: Remove duplicate Gender from types.ts

**Files:**
- Modify: `apps/client/src/types.ts`

- [ ] **Step 1: Replace local Gender with re-export from shared**

In `apps/client/src/types.ts`, remove:

```ts
export type Gender = "homme" | "femme";
```

And add at the top (after the `StrapiList` interface):

```ts
export type { Gender } from "./shared/types";
```

- [ ] **Step 2: Run type check**

Run: `bun --filter '*' check-types`
Expected: PASS — all files that import `Gender` from `../types` still work via re-export.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/types.ts
git commit -m "refactor: types.ts re-exports Gender from shared, removes duplicate"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full check suite**

```bash
bun --filter '*' check-types && bunx biome check apps/client/src/ && bun --filter '*' test
```

Expected: types PASS, biome 0 errors (2 pre-existing warnings OK), 17 tests PASS.

- [ ] **Step 2: Verify no behavior changes**

```bash
git diff --stat master..HEAD
```

Verify only the expected files were changed and no component/feature logic was modified.

- [ ] **Step 3: Final commit if any fixups needed**

If biome auto-formatting is needed:

```bash
bunx biome check --write apps/client/src/
git add -A && git commit -m "chore: biome formatting fixups"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Shared types module | `shared/types.ts` (create) |
| 2 | Server types re-export | `server/types.ts` |
| 3 | roomStore uses shared types + typed WS handler | `stores/roomStore.ts` |
| 4 | Shared scoring utilities | `shared/scoring.ts` (create) |
| 5 | game-engine uses shared shuffle + removes casts | `server/game-engine.ts` |
| 6 | gameStore uses shared shuffle | `stores/gameStore.ts` |
| 7 | Remove redundant casts in ws.ts | `server/ws.ts`, `server/alcohol/framework.ts` |
| 8 | Reverse index + reassignHost | `server/rooms.ts` |
| 9 | Remove duplicate Gender | `types.ts` |
| 10 | Final verification | All |
