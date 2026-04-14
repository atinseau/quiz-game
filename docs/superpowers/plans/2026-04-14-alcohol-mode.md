# Mode Alcool — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add party drinking mode with plugin-based special rounds (Petit buveur, Distributeur, Question de courage), config UI, DrinkAlert notifications, and cul-sec end-of-game — compatible solo and multi-device.

**Architecture:** Plugin registry pattern — each round is an isolated module (server logic + client component). Framework handles triggering, queue, and dispatch. Alcohol state lives in `alcoholStore` (solo) and `server/alcohol/framework.ts` (multi). Existing stores/engine are minimally modified.

**Tech Stack:** React 19, Zustand, Bun WebSocket, shadcn/ui (Slider, Switch)

**Spec:** `docs/superpowers/specs/2026-04-14-alcohol-mode-design.md`

---

## File Structure

### New files

```
src/server/alcohol/
  types.ts                      — ServerRound interface, AlcoholConfig, AlcoholState, SpecialRoundType
  framework.ts                  — checkTrigger, initAlcohol, handleAlcoholMessage, queue logic
  rounds/
    petit-buveur.ts             — server logic: find loser(s), send drink_alert
    distributeur.ts             — server logic: prompt distributor, handle 3 taps
    courage.ts                  — server logic: random player, decision, question, result
    index.ts                    — registry Map<SpecialRoundType, ServerRound>

src/stores/
  alcoholStore.ts               — Zustand store for solo alcohol state + drink alerts

src/components/alcohol/
  DrinkAlert.tsx                — fullscreen overlay notification (emoji + message)
  SpecialRoundOverlay.tsx       — modal overlay that renders the active round component
  AlcoholConfig.tsx             — config UI (toggle, slider, checkboxes)
  rounds/
    PetitBuveur.tsx             — UI: who drinks
    Distributeur.tsx            — UI: 3 taps to distribute drinks
    QuestionDeCourage.tsx       — UI: accept/refuse + question
    index.ts                    — registry Map<SpecialRoundType, ComponentType>
```

### Modified files

```
src/server/types.ts             — add alcohol WS messages to ServerMessage/ClientMessage
src/server/game-engine.ts       — call framework.checkTrigger after each turn
src/server/ws.ts                — route alcohol messages to framework
src/stores/roomStore.ts         — handle alcohol WS messages, delegate to alcoholStore
src/stores/gameStore.ts         — call alcoholStore.checkTrigger after each turn (solo)
src/components/HomeScreen.tsx   — add AlcoholConfig step after mode selection
src/components/MultiLobby.tsx   — add AlcoholConfig for host
src/components/GameScreen.tsx   — render SpecialRoundOverlay + DrinkAlert
src/components/MultiGameScreen.tsx — render SpecialRoundOverlay + DrinkAlert
src/components/EndScreen.tsx    — show cul-sec DrinkAlert before rankings
src/components/MultiEndScreen.tsx — show cul-sec DrinkAlert before rankings
```

---

## Task 1: Alcohol Types (Server + Shared)

**Files:**
- Create: `apps/client/src/server/alcohol/types.ts`
- Modify: `apps/client/src/server/types.ts`

- [ ] **Step 1: Create alcohol types**

```ts
// apps/client/src/server/alcohol/types.ts
import type { QuestionWithoutAnswer, Room } from "../types";

export type SpecialRoundType =
  | "petit_buveur"
  | "distributeur"
  | "courage"
  | "conseil"
  | "love_or_drink"
  | "cupidon"
  | "show_us"
  | "smatch_or_pass";

export interface AlcoholConfig {
  enabled: boolean;
  frequency: number;
  enabledRounds: SpecialRoundType[];
  culSecEndGame: boolean;
}

export interface AlcoholState {
  config: AlcoholConfig;
  turnsSinceLastSpecial: number;
  specialRoundQueue: SpecialRoundType[];
  activeRound: SpecialRoundType | null;
}

export interface ServerRound {
  type: SpecialRoundType;
  start(room: Room, state: AlcoholState): void;
  handleMessage(room: Room, state: AlcoholState, clerkId: string, msg: Record<string, unknown>): void;
}

export const DEFAULT_ALCOHOL_CONFIG: AlcoholConfig = {
  enabled: false,
  frequency: 5,
  enabledRounds: ["petit_buveur", "distributeur", "courage"],
  culSecEndGame: true,
};
```

- [ ] **Step 2: Add alcohol messages to server/types.ts**

Add to `ClientMessage` union:

```ts
  | { type: "courage_choice"; accept: boolean }
  | { type: "courage_answer"; answer: string | boolean }
  | { type: "distribute_drink"; targetClerkId: string }
```

Add to `ServerMessage` union:

```ts
  | { type: "special_round_start"; roundType: SpecialRoundType; data: Record<string, unknown> }
  | { type: "drink_alert"; targetClerkId: string; emoji: string; message: string }
  | { type: "courage_decision"; playerClerkId: string; countdown: number }
  | { type: "courage_question"; question: QuestionWithoutAnswer }
  | { type: "courage_result"; correct: boolean; pointsDelta: number }
  | { type: "distribute_prompt"; distributorClerkId: string; remaining: number }
  | { type: "special_round_end" }
```

Import `SpecialRoundType` from `./alcohol/types`.

Also add `alcoholConfig: AlcoholConfig | null` to the `Room` interface and `alcoholState: AlcoholState | null` to `GameState`.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/server/alcohol/ apps/client/src/server/types.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add types, interfaces, and WS messages"
```

---

## Task 2: Server Framework (Trigger + Queue)

**Files:**
- Create: `apps/client/src/server/alcohol/framework.ts`

- [ ] **Step 1: Create the framework**

```ts
// apps/client/src/server/alcohol/framework.ts
import { broadcast } from "../rooms";
import type { Room } from "../types";
import type { AlcoholConfig, AlcoholState, SpecialRoundType, ServerRound } from "./types";
import { DEFAULT_ALCOHOL_CONFIG } from "./types";
import { roundRegistry } from "./rounds";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export function initAlcoholState(config: AlcoholConfig): AlcoholState {
  return {
    config,
    turnsSinceLastSpecial: 0,
    specialRoundQueue: shuffleArray(config.enabledRounds.filter((r) => roundRegistry.has(r))),
    activeRound: null,
  };
}

export function checkTrigger(room: Room): boolean {
  const game = room.game;
  if (!game?.alcoholState || !game.alcoholState.config.enabled) return false;

  const state = game.alcoholState;
  state.turnsSinceLastSpecial++;

  if (state.turnsSinceLastSpecial < state.config.frequency) return false;

  // Time to trigger a special round
  state.turnsSinceLastSpecial = 0;

  // Refill queue if empty
  if (state.specialRoundQueue.length === 0) {
    state.specialRoundQueue = shuffleArray(
      state.config.enabledRounds.filter((r) => roundRegistry.has(r))
    );
  }

  const roundType = state.specialRoundQueue.shift();
  if (!roundType) return false;

  const round = roundRegistry.get(roundType);
  if (!round) return false;

  state.activeRound = roundType;
  round.start(room, state);
  return true;
}

export function handleAlcoholMessage(
  room: Room,
  clerkId: string,
  msg: Record<string, unknown>,
): void {
  const game = room.game;
  if (!game?.alcoholState?.activeRound) return;

  const round = roundRegistry.get(game.alcoholState.activeRound);
  if (!round) return;

  round.handleMessage(room, game.alcoholState, clerkId, msg);
}

export function endSpecialRound(room: Room): void {
  const game = room.game;
  if (!game?.alcoholState) return;

  game.alcoholState.activeRound = null;
  broadcast(room, { type: "special_round_end" });
}

export function handleCulSecEndGame(room: Room): void {
  const game = room.game;
  if (!game?.alcoholState?.config.culSecEndGame) return;

  const scores = game.scores;
  const minScore = Math.min(...Object.values(scores));
  const losers = Object.entries(scores)
    .filter(([_, score]) => score === minScore)
    .map(([clerkId]) => clerkId);

  for (const clerkId of losers) {
    const player = room.players.get(clerkId);
    const name = player?.username ?? "?";
    broadcast(room, {
      type: "drink_alert",
      targetClerkId: clerkId,
      emoji: "🍻",
      message: `CUL SEC ! ${name} a perdu !`,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/server/alcohol/framework.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add server framework (trigger, queue, cul-sec)"
```

---

## Task 3: Server Rounds (Petit Buveur + Distributeur + Courage)

**Files:**
- Create: `apps/client/src/server/alcohol/rounds/petit-buveur.ts`
- Create: `apps/client/src/server/alcohol/rounds/distributeur.ts`
- Create: `apps/client/src/server/alcohol/rounds/courage.ts`
- Create: `apps/client/src/server/alcohol/rounds/index.ts`

- [ ] **Step 1: Petit Buveur**

```ts
// apps/client/src/server/alcohol/rounds/petit-buveur.ts
import { broadcast } from "../../rooms";
import type { Room } from "../../types";
import { endSpecialRound } from "../framework";
import type { AlcoholState, ServerRound } from "../types";

export const petitBuveurRound: ServerRound = {
  type: "petit_buveur",

  start(room: Room, _state: AlcoholState) {
    const game = room.game;
    if (!game) return;

    const minScore = Math.min(...Object.values(game.scores));
    const losers = Object.entries(game.scores)
      .filter(([_, score]) => score === minScore)
      .map(([clerkId]) => {
        const player = room.players.get(clerkId);
        return { clerkId, username: player?.username ?? "?" };
      });

    broadcast(room, {
      type: "special_round_start",
      roundType: "petit_buveur",
      data: { losers },
    });

    for (const loser of losers) {
      broadcast(room, {
        type: "drink_alert",
        targetClerkId: loser.clerkId,
        emoji: "🍺",
        message: `${loser.username} boit une gorgée !`,
      });
    }

    setTimeout(() => endSpecialRound(room), 5000);
  },

  handleMessage() {},
};
```

- [ ] **Step 2: Distributeur**

```ts
// apps/client/src/server/alcohol/rounds/distributeur.ts
import { broadcast } from "../../rooms";
import type { Room } from "../../types";
import { endSpecialRound } from "../framework";
import type { AlcoholState, ServerRound } from "../types";

const distributorState = new Map<string, { remaining: number; timeoutId: ReturnType<typeof setTimeout> }>();

export const distributeurRound: ServerRound = {
  type: "distributeur",

  start(room: Room, _state: AlcoholState) {
    const game = room.game;
    if (!game) return;

    const maxScore = Math.max(...Object.values(game.scores));
    const winnerId = Object.entries(game.scores).find(([_, s]) => s === maxScore)?.[0];
    if (!winnerId) { endSpecialRound(room); return; }

    const winner = room.players.get(winnerId);
    broadcast(room, {
      type: "special_round_start",
      roundType: "distributeur",
      data: { distributorClerkId: winnerId, distributorName: winner?.username ?? "?" },
    });

    broadcast(room, {
      type: "distribute_prompt",
      distributorClerkId: winnerId,
      remaining: 3,
    });

    // Timeout 30s
    const timeoutId = setTimeout(() => {
      distributorState.delete(room.code);
      endSpecialRound(room);
    }, 30_000);

    distributorState.set(room.code, { remaining: 3, timeoutId });
  },

  handleMessage(room: Room, _state: AlcoholState, clerkId: string, msg: Record<string, unknown>) {
    if (msg.type !== "distribute_drink") return;

    const ds = distributorState.get(room.code);
    if (!ds || ds.remaining <= 0) return;

    const targetClerkId = msg.targetClerkId as string;
    const target = room.players.get(targetClerkId);
    const distributor = room.players.get(clerkId);

    broadcast(room, {
      type: "drink_alert",
      targetClerkId,
      emoji: "🍺",
      message: `${distributor?.username ?? "?"} t'envoie une gorgée !`,
    });

    ds.remaining--;

    if (ds.remaining <= 0) {
      clearTimeout(ds.timeoutId);
      distributorState.delete(room.code);
      setTimeout(() => endSpecialRound(room), 2000);
    } else {
      broadcast(room, {
        type: "distribute_prompt",
        distributorClerkId: clerkId,
        remaining: ds.remaining,
      });
    }
  },
};
```

- [ ] **Step 3: Question de Courage**

```ts
// apps/client/src/server/alcohol/rounds/courage.ts
import { broadcast } from "../../rooms";
import { checkAnswer } from "../../utils/fuzzyMatch";
import type { QuestionFull, Room } from "../../types";
import { endSpecialRound } from "../framework";
import type { AlcoholState, ServerRound } from "../types";

interface CourageState {
  playerClerkId: string;
  question: QuestionFull | null;
  decisionTimeout: ReturnType<typeof setTimeout>;
}

const courageStates = new Map<string, CourageState>();

function getRandomConnectedPlayer(room: Room): string | null {
  const connected = Array.from(room.players.values()).filter((p) => p.connected);
  if (connected.length === 0) return null;
  return connected[Math.floor(Math.random() * connected.length)]!.clerkId;
}

function pickCourageQuestion(room: Room): QuestionFull | null {
  const game = room.game;
  if (!game) return null;

  // Find a QCM question that hasn't been played yet (after current index)
  for (let i = game.currentQuestionIndex + 1; i < game.questions.length; i++) {
    const q = game.questions[i];
    if (q && q.type === "qcm") {
      // Remove it from the pool
      game.questions.splice(i, 1);
      return q;
    }
  }
  return null;
}

export const courageRound: ServerRound = {
  type: "courage",

  start(room: Room, _state: AlcoholState) {
    const playerClerkId = getRandomConnectedPlayer(room);
    if (!playerClerkId) { endSpecialRound(room); return; }

    const player = room.players.get(playerClerkId);
    broadcast(room, {
      type: "special_round_start",
      roundType: "courage",
      data: { playerClerkId, playerName: player?.username ?? "?" },
    });

    broadcast(room, {
      type: "courage_decision",
      playerClerkId,
      countdown: 10,
    });

    // 10s timeout = refuse
    const decisionTimeout = setTimeout(() => {
      const cs = courageStates.get(room.code);
      if (!cs) return;
      courageStates.delete(room.code);

      broadcast(room, {
        type: "drink_alert",
        targetClerkId: playerClerkId,
        emoji: "🥃",
        message: `${player?.username ?? "?"} n'a pas choisi — la moitié du verre !`,
      });

      setTimeout(() => endSpecialRound(room), 4000);
    }, 10_000);

    courageStates.set(room.code, { playerClerkId, question: null, decisionTimeout });
  },

  handleMessage(room: Room, _state: AlcoholState, clerkId: string, msg: Record<string, unknown>) {
    const cs = courageStates.get(room.code);
    if (!cs || cs.playerClerkId !== clerkId) return;

    if (msg.type === "courage_choice") {
      clearTimeout(cs.decisionTimeout);
      const accept = msg.accept as boolean;
      const player = room.players.get(clerkId);

      if (!accept) {
        courageStates.delete(room.code);
        broadcast(room, {
          type: "drink_alert",
          targetClerkId: clerkId,
          emoji: "🥃",
          message: `${player?.username ?? "?"} refuse — la moitié du verre !`,
        });
        setTimeout(() => endSpecialRound(room), 4000);
        return;
      }

      // Accept: pick a question
      const question = pickCourageQuestion(room);
      if (!question) {
        courageStates.delete(room.code);
        endSpecialRound(room);
        return;
      }

      cs.question = question;

      // Send as texte (no choices) even though it's a QCM
      broadcast(room, {
        type: "courage_question",
        question: { type: "texte", text: question.text, category: question.category },
      });
    }

    if (msg.type === "courage_answer") {
      if (!cs.question) return;
      courageStates.delete(room.code);

      const answer = msg.answer as string | boolean;
      const correct = checkAnswer(answer, cs.question);
      const player = room.players.get(clerkId);
      const game = room.game;

      let pointsDelta = 0;
      if (correct && game) {
        pointsDelta = 2;
        game.scores[clerkId] = (game.scores[clerkId] ?? 0) + 2;
      }

      broadcast(room, { type: "courage_result", correct, pointsDelta });

      if (!correct) {
        broadcast(room, {
          type: "drink_alert",
          targetClerkId: clerkId,
          emoji: "🍻",
          message: `${player?.username ?? "?"} se trompe — CUL SEC !`,
        });
      }

      setTimeout(() => endSpecialRound(room), 4000);
    }
  },
};
```

- [ ] **Step 4: Registry**

```ts
// apps/client/src/server/alcohol/rounds/index.ts
import type { SpecialRoundType, ServerRound } from "../types";
import { courageRound } from "./courage";
import { distributeurRound } from "./distributeur";
import { petitBuveurRound } from "./petit-buveur";

export const roundRegistry = new Map<SpecialRoundType, ServerRound>([
  ["petit_buveur", petitBuveurRound],
  ["distributeur", distributeurRound],
  ["courage", courageRound],
]);
```

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/server/alcohol/rounds/
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add server rounds (petit buveur, distributeur, courage)"
```

---

## Task 4: Wire Framework into Game Engine + WS

**Files:**
- Modify: `apps/client/src/server/game-engine.ts`
- Modify: `apps/client/src/server/ws.ts`

- [ ] **Step 1: Update game-engine.ts**

Import the framework:
```ts
import { checkTrigger, handleCulSecEndGame, initAlcoholState } from "./alcohol/framework";
import type { AlcoholConfig } from "./alcohol/types";
```

In `startGame(room)`, after creating `room.game`, init alcohol state if config provided:
```ts
// After room.game = game;
if (room.alcoholConfig) {
  game.alcoholState = initAlcoholState(room.alcoholConfig);
}
```

In `scheduleNextQuestion`, before calling `sendQuestion`, check for special round:
```ts
// After game.currentQuestionIndex = nextIndex; and advanceToNextConnectedPlayer
const triggered = checkTrigger(room);
if (triggered) {
  // Special round is active — sendQuestion will be called after it ends
  // The endSpecialRound function should call sendQuestion
  return;
}
sendQuestion(room);
```

Update `endSpecialRound` in framework.ts to call `sendQuestion` after ending:
```ts
// In framework.ts endSpecialRound, after broadcasting special_round_end:
// Import and call sendQuestion
```

Actually, simpler: in `scheduleNextQuestion`, after `checkTrigger` returns true, set a callback. Or: make `endSpecialRound` resume the game by calling a passed callback.

Simplest approach: `endSpecialRound` calls a `resumeGame(room)` that is exported from game-engine:

Add to game-engine.ts:
```ts
export function resumeGame(room: Room): void {
  sendQuestion(room);
}
```

Update framework.ts `endSpecialRound`:
```ts
import { resumeGame } from "../game-engine";

export function endSpecialRound(room: Room): void {
  // ...
  broadcast(room, { type: "special_round_end" });
  // Resume the game after a brief pause
  setTimeout(() => resumeGame(room), 1000);
}
```

In `endGame`, before broadcasting `game_over`, call `handleCulSecEndGame`:
```ts
handleCulSecEndGame(room);
// Wait 5s for drink alerts, then send game_over
setTimeout(() => {
  broadcast(room, { type: "game_over", scores, rankings: entries });
  room.status = "lobby";
  room.game = null;
}, room.game?.alcoholState?.config.culSecEndGame ? 5000 : 0);
```

- [ ] **Step 2: Update ws.ts — route alcohol messages**

Import:
```ts
import { handleAlcoholMessage } from "./alcohol/framework";
```

Add cases in the switch for `courage_choice`, `courage_answer`, `distribute_drink`:
```ts
case "courage_choice":
case "courage_answer":
case "distribute_drink": {
  const room = findRoomByPlayer(clerkId);
  if (!room || !room.game) return;
  handleAlcoholMessage(room, clerkId, msg as Record<string, unknown>);
  break;
}
```

Also update `start_game` case to accept `alcoholConfig`:
```ts
case "start_game": {
  // ... existing validation ...
  if (msg.alcoholConfig) {
    room.alcoholConfig = msg.alcoholConfig;
  }
  room.status = "playing";
  broadcast(room, { type: "game_starting" });
  await startGameEngine(room);
  break;
}
```

- [ ] **Step 3: Verify types**

```bash
cd apps/client && bunx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/server/game-engine.ts apps/client/src/server/ws.ts apps/client/src/server/alcohol/framework.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): wire framework into game engine and WS handlers"
```

---

## Task 5: AlcoholStore (Solo) 

**Files:**
- Create: `apps/client/src/stores/alcoholStore.ts`

- [ ] **Step 1: Create the store**

```ts
// apps/client/src/stores/alcoholStore.ts
import { create } from "zustand";

export type SpecialRoundType =
  | "petit_buveur" | "distributeur" | "courage"
  | "conseil" | "love_or_drink" | "cupidon" | "show_us" | "smatch_or_pass";

export interface AlcoholConfig {
  enabled: boolean;
  frequency: number;
  enabledRounds: SpecialRoundType[];
  culSecEndGame: boolean;
}

export interface DrinkAlertData {
  id: string;
  emoji: string;
  message: string;
}

interface AlcoholStore {
  config: AlcoholConfig;
  turnsSinceLastSpecial: number;
  specialRoundQueue: SpecialRoundType[];
  activeRound: SpecialRoundType | null;
  activeRoundData: Record<string, unknown> | null;
  drinkAlerts: DrinkAlertData[];

  setConfig: (config: AlcoholConfig) => void;
  checkTrigger: (scores: Record<string, number>) => SpecialRoundType | null;
  setActiveRound: (type: SpecialRoundType | null, data?: Record<string, unknown>) => void;
  addDrinkAlert: (alert: Omit<DrinkAlertData, "id">) => void;
  removeDrinkAlert: (id: string) => void;
  reset: () => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

const AVAILABLE_ROUNDS: SpecialRoundType[] = ["petit_buveur", "distributeur", "courage"];

export const useAlcoholStore = create<AlcoholStore>((set, get) => ({
  config: {
    enabled: false,
    frequency: 5,
    enabledRounds: ["petit_buveur", "distributeur", "courage"],
    culSecEndGame: true,
  },
  turnsSinceLastSpecial: 0,
  specialRoundQueue: [],
  activeRound: null,
  activeRoundData: null,
  drinkAlerts: [],

  setConfig: (config) => {
    set({
      config,
      specialRoundQueue: shuffleArray(
        config.enabledRounds.filter((r) => AVAILABLE_ROUNDS.includes(r))
      ),
      turnsSinceLastSpecial: 0,
    });
  },

  checkTrigger: (_scores) => {
    const state = get();
    if (!state.config.enabled) return null;

    const next = state.turnsSinceLastSpecial + 1;
    if (next < state.config.frequency) {
      set({ turnsSinceLastSpecial: next });
      return null;
    }

    // Trigger
    let queue = [...state.specialRoundQueue];
    if (queue.length === 0) {
      queue = shuffleArray(
        state.config.enabledRounds.filter((r) => AVAILABLE_ROUNDS.includes(r))
      );
    }

    const roundType = queue.shift() ?? null;
    set({
      turnsSinceLastSpecial: 0,
      specialRoundQueue: queue,
    });

    return roundType;
  },

  setActiveRound: (type, data) => set({
    activeRound: type,
    activeRoundData: data ?? null,
  }),

  addDrinkAlert: (alert) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((s) => ({ drinkAlerts: [...s.drinkAlerts, { ...alert, id }] }));
  },

  removeDrinkAlert: (id) => {
    set((s) => ({ drinkAlerts: s.drinkAlerts.filter((a) => a.id !== id) }));
  },

  reset: () => set({
    turnsSinceLastSpecial: 0,
    specialRoundQueue: [],
    activeRound: null,
    activeRoundData: null,
    drinkAlerts: [],
  }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/stores/alcoholStore.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add alcoholStore for solo mode"
```

---

## Task 6: DrinkAlert + SpecialRoundOverlay Components

**Files:**
- Create: `apps/client/src/components/alcohol/DrinkAlert.tsx`
- Create: `apps/client/src/components/alcohol/SpecialRoundOverlay.tsx`

- [ ] **Step 1: DrinkAlert**

```tsx
// apps/client/src/components/alcohol/DrinkAlert.tsx
import { useEffect } from "react";

interface DrinkAlertProps {
  emoji: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

export function DrinkAlert({ emoji, message, onClose, duration = 4000 }: DrinkAlertProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="button"
      tabIndex={0}
    >
      <div className="text-center animate-bounce-in">
        <span className="text-8xl block mb-6">{emoji}</span>
        <p className="text-2xl font-bold text-white max-w-sm">{message}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: SpecialRoundOverlay**

```tsx
// apps/client/src/components/alcohol/SpecialRoundOverlay.tsx
import { clientRoundRegistry } from "./rounds";

interface SpecialRoundOverlayProps {
  roundType: string;
  data: Record<string, unknown>;
}

export function SpecialRoundOverlay({ roundType, data }: SpecialRoundOverlayProps) {
  const Component = clientRoundRegistry.get(roundType as any);

  if (!Component) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 animate-bounce-in">
        <Component data={data} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/alcohol/DrinkAlert.tsx apps/client/src/components/alcohol/SpecialRoundOverlay.tsx
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add DrinkAlert and SpecialRoundOverlay components"
```

---

## Task 7: Client Round Components + Registry

**Files:**
- Create: `apps/client/src/components/alcohol/rounds/PetitBuveur.tsx`
- Create: `apps/client/src/components/alcohol/rounds/Distributeur.tsx`
- Create: `apps/client/src/components/alcohol/rounds/QuestionDeCourage.tsx`
- Create: `apps/client/src/components/alcohol/rounds/index.ts`

- [ ] **Step 1: PetitBuveur**

```tsx
// apps/client/src/components/alcohol/rounds/PetitBuveur.tsx
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  data: Record<string, unknown>;
}

export function PetitBuveur({ data }: Props) {
  const losers = (data.losers as { clerkId: string; username: string }[]) ?? [];

  return (
    <Card className="bg-card/90 border-amber-500/30">
      <CardContent className="py-8 text-center">
        <span className="text-6xl block mb-4">🍺</span>
        <h2 className="text-2xl font-bold mb-4">Petit buveur !</h2>
        <div className="space-y-2">
          {losers.map((l) => (
            <p key={l.clerkId} className="text-lg text-amber-400 font-semibold">
              {l.username} boit une gorgée
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Distributeur**

```tsx
// apps/client/src/components/alcohol/rounds/Distributeur.tsx
import { useRoomStore } from "../../../stores/roomStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  data: Record<string, unknown>;
}

export function Distributeur({ data }: Props) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const room = useRoomStore((s) => s.room);
  const ws = useRoomStore((s) => s.ws);

  const distributorClerkId = data.distributorClerkId as string;
  const distributorName = data.distributorName as string;
  const remaining = (data.remaining as number) ?? 0;
  const isDistributor = myClerkId === distributorClerkId;

  const otherPlayers = room?.players.filter((p) => p.clerkId !== distributorClerkId && p.connected) ?? [];

  const sendDrink = (targetClerkId: string) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "distribute_drink", targetClerkId }));
    }
  };

  return (
    <Card className="bg-card/90 border-amber-500/30">
      <CardContent className="py-8 text-center">
        <span className="text-6xl block mb-4">🎯</span>
        <h2 className="text-2xl font-bold mb-2">Distributeur !</h2>
        <p className="text-muted-foreground mb-4">
          {distributorName} distribue {remaining} gorgée{remaining > 1 ? "s" : ""}
        </p>
        {isDistributor ? (
          <div className="space-y-3">
            {otherPlayers.map((p) => (
              <Button
                key={p.clerkId}
                size="lg"
                className="w-full"
                onClick={() => sendDrink(p.clerkId)}
                disabled={remaining <= 0}
              >
                🍺 {p.username}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            En attente de {distributorName}...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: QuestionDeCourage**

```tsx
// apps/client/src/components/alcohol/rounds/QuestionDeCourage.tsx
import { useEffect, useState } from "react";
import { useRoomStore } from "../../../stores/roomStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Props {
  data: Record<string, unknown>;
}

export function QuestionDeCourage({ data }: Props) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const ws = useRoomStore((s) => s.ws);

  const playerClerkId = data.playerClerkId as string;
  const playerName = data.playerName as string;
  const isMe = myClerkId === playerClerkId;

  const [phase, setPhase] = useState<"decision" | "question" | "waiting">("decision");
  const [countdown, setCountdown] = useState(10);
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState<{ text: string; category: string } | null>(null);

  // Countdown timer
  useEffect(() => {
    if (phase !== "decision") return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Listen for courage_question and courage_result from roomStore
  // These come as WS messages — the roomStore should update alcoholStore
  // For now, we handle via the data prop updates

  const sendChoice = (accept: boolean) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "courage_choice", accept }));
    }
    setPhase(accept ? "question" : "waiting");
  };

  const sendAnswer = () => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "courage_answer", answer }));
    }
    setPhase("waiting");
  };

  return (
    <Card className="bg-card/90 border-amber-500/30">
      <CardContent className="py-8 text-center">
        <span className="text-6xl block mb-4">🎰</span>
        <h2 className="text-2xl font-bold mb-2">Question de courage !</h2>
        <p className="text-lg mb-4">{playerName} est tiré au sort</p>

        {phase === "decision" && isMe && (
          <div className="space-y-3">
            <p className="text-3xl font-bold text-amber-400">{countdown}s</p>
            <p className="text-sm text-muted-foreground mb-4">
              Accepte le défi ou bois la moitié de ton verre
            </p>
            <div className="flex gap-3 justify-center">
              <Button size="lg" onClick={() => sendChoice(true)} className="bg-green-600 hover:bg-green-700">
                J'accepte !
              </Button>
              <Button size="lg" variant="destructive" onClick={() => sendChoice(false)}>
                Je passe...
              </Button>
            </div>
          </div>
        )}

        {phase === "decision" && !isMe && (
          <p className="text-muted-foreground">
            {playerName} décide... {countdown}s
          </p>
        )}

        {phase === "question" && isMe && (
          <div className="space-y-4">
            <p className="text-lg font-semibold">
              {question?.text ?? data.questionText as string ?? "Question difficile..."}
            </p>
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Ta réponse..."
              className="text-center"
              onKeyDown={(e) => e.key === "Enter" && answer.trim() && sendAnswer()}
            />
            <Button onClick={sendAnswer} disabled={!answer.trim()}>
              Valider
            </Button>
          </div>
        )}

        {phase === "question" && !isMe && (
          <p className="text-muted-foreground">{playerName} répond au défi...</p>
        )}

        {phase === "waiting" && (
          <p className="text-muted-foreground animate-pulse">En attente...</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Client Registry**

```tsx
// apps/client/src/components/alcohol/rounds/index.ts
import type { ComponentType } from "react";
import { Distributeur } from "./Distributeur";
import { PetitBuveur } from "./PetitBuveur";
import { QuestionDeCourage } from "./QuestionDeCourage";

interface RoundProps {
  data: Record<string, unknown>;
}

export const clientRoundRegistry = new Map<string, ComponentType<RoundProps>>([
  ["petit_buveur", PetitBuveur],
  ["distributeur", Distributeur],
  ["courage", QuestionDeCourage],
]);
```

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/alcohol/rounds/
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add client round components + registry"
```

---

## Task 8: AlcoholConfig UI

**Files:**
- Create: `apps/client/src/components/alcohol/AlcoholConfig.tsx`

- [ ] **Step 1: Create the config component**

Uses shadcn Slider (install if needed: `bunx shadcn@latest add slider switch`).

```tsx
// apps/client/src/components/alcohol/AlcoholConfig.tsx
import { Beer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AlcoholConfigProps {
  enabled: boolean;
  frequency: number;
  enabledRounds: string[];
  culSecEndGame: boolean;
  onChange: (config: {
    enabled: boolean;
    frequency: number;
    enabledRounds: string[];
    culSecEndGame: boolean;
  }) => void;
}

const ROUNDS = [
  { id: "petit_buveur", name: "Petit buveur", emoji: "🍺", available: true },
  { id: "distributeur", name: "Distributeur", emoji: "🎯", available: true },
  { id: "courage", name: "Question de courage", emoji: "🎰", available: true },
  { id: "conseil", name: "Conseil du village", emoji: "🗳️", available: false },
  { id: "love_or_drink", name: "Love or Drink", emoji: "💋", available: false },
  { id: "cupidon", name: "Cupidon", emoji: "💘", available: false },
  { id: "show_us", name: "Show Us", emoji: "👀", available: false },
  { id: "smatch_or_pass", name: "Smatch or Pass", emoji: "💥", available: false },
];

export function AlcoholConfig({ enabled, frequency, enabledRounds, culSecEndGame, onChange }: AlcoholConfigProps) {
  const toggle = () => onChange({ enabled: !enabled, frequency, enabledRounds, culSecEndGame });
  const setFreq = (f: number) => onChange({ enabled, frequency: f, enabledRounds, culSecEndGame });
  const toggleRound = (id: string) => {
    const next = enabledRounds.includes(id)
      ? enabledRounds.filter((r) => r !== id)
      : [...enabledRounds, id];
    onChange({ enabled, frequency, enabledRounds: next, culSecEndGame });
  };
  const toggleCulSec = () => onChange({ enabled, frequency, enabledRounds, culSecEndGame: !culSecEndGame });

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Beer className="size-5 text-amber-500" />
            Mode Soirée
          </span>
          <Button
            variant={enabled ? "default" : "outline"}
            size="sm"
            onClick={toggle}
            className={enabled ? "bg-amber-600 hover:bg-amber-700" : ""}
          >
            {enabled ? "Activé 🍻" : "Désactivé"}
          </Button>
        </CardTitle>
      </CardHeader>
      {enabled && (
        <CardContent className="space-y-6">
          {/* Frequency */}
          <div>
            <p className="text-sm font-medium mb-2">
              Manche spéciale tous les <strong className="text-amber-400">{frequency}</strong> tours
            </p>
            <div className="flex gap-2">
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={frequency === n ? "default" : "outline"}
                  className={frequency === n ? "bg-amber-600" : ""}
                  onClick={() => setFreq(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          {/* Rounds */}
          <div>
            <p className="text-sm font-medium mb-2">Manches actives</p>
            <div className="space-y-2">
              {ROUNDS.map((round) => (
                <button
                  type="button"
                  key={round.id}
                  disabled={!round.available}
                  onClick={() => round.available && toggleRound(round.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                    !round.available
                      ? "opacity-40 cursor-not-allowed"
                      : enabledRounds.includes(round.id)
                        ? "bg-amber-500/20 ring-1 ring-amber-500/30"
                        : "bg-card/50 hover:bg-card/80"
                  }`}
                >
                  <span className="text-xl">{round.emoji}</span>
                  <span className="flex-1 text-sm font-medium">{round.name}</span>
                  {!round.available && (
                    <Badge variant="secondary" className="text-xs">Bientôt</Badge>
                  )}
                  {round.available && enabledRounds.includes(round.id) && (
                    <span className="text-amber-400 text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Cul sec */}
          <button
            type="button"
            onClick={toggleCulSec}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
              culSecEndGame
                ? "bg-red-500/20 ring-1 ring-red-500/30"
                : "bg-card/50 hover:bg-card/80"
            }`}
          >
            <span className="text-xl">🍻</span>
            <span className="flex-1 text-sm font-medium">Le perdant boit cul sec</span>
            {culSecEndGame && <span className="text-red-400 text-sm">✓</span>}
          </button>
        </CardContent>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/components/alcohol/AlcoholConfig.tsx
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add AlcoholConfig UI component"
```

---

## Task 9: Integrate into HomeScreen + MultiLobby

**Files:**
- Modify: `apps/client/src/components/HomeScreen.tsx`
- Modify: `apps/client/src/components/MultiLobby.tsx`

- [ ] **Step 1: Add AlcoholConfig to HomeScreen**

After the mode selection step, add the AlcoholConfig component. Store the config in local state and pass it to `startGame`.

Read `HomeScreen.tsx`. After the mode selection buttons and before "Lancer la partie", add:

```tsx
import { AlcoholConfig } from "./alcohol/AlcoholConfig";
import { useAlcoholStore } from "../stores/alcoholStore";

// In the component:
const alcoholConfig = useAlcoholStore((s) => s.config);
const setAlcoholConfig = useAlcoholStore((s) => s.setConfig);

// After mode selection, before launch button:
<AlcoholConfig
  enabled={alcoholConfig.enabled}
  frequency={alcoholConfig.frequency}
  enabledRounds={alcoholConfig.enabledRounds}
  culSecEndGame={alcoholConfig.culSecEndGame}
  onChange={setAlcoholConfig}
/>
```

- [ ] **Step 2: Add AlcoholConfig to MultiLobby**

For the host, add the AlcoholConfig after mode selection. Send `alcoholConfig` with `start_game`.

Read `MultiLobby.tsx` and add the config UI for the host.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/client && bunx tsc --noEmit && bun test src/
git add apps/client/src/components/HomeScreen.tsx apps/client/src/components/MultiLobby.tsx
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): integrate AlcoholConfig into HomeScreen and MultiLobby"
```

---

## Task 10: Integrate Overlays into GameScreen + MultiGameScreen

**Files:**
- Modify: `apps/client/src/components/GameScreen.tsx`
- Modify: `apps/client/src/components/MultiGameScreen.tsx`
- Modify: `apps/client/src/components/EndScreen.tsx`
- Modify: `apps/client/src/components/MultiEndScreen.tsx`
- Modify: `apps/client/src/stores/roomStore.ts`

- [ ] **Step 1: Add alcohol message handlers to roomStore**

Handle `special_round_start`, `drink_alert`, `courage_decision`, `courage_question`, `courage_result`, `distribute_prompt`, `special_round_end` in the WS `onmessage` handler. Update `alcoholStore` accordingly.

- [ ] **Step 2: Render overlays in GameScreen (solo)**

Add `SpecialRoundOverlay` and `DrinkAlert` from `alcoholStore` state.

- [ ] **Step 3: Render overlays in MultiGameScreen**

Same pattern, reading from `roomStore` → `alcoholStore`.

- [ ] **Step 4: Add cul-sec to EndScreen and MultiEndScreen**

Show `DrinkAlert` for the loser before showing rankings (if alcohol was enabled).

- [ ] **Step 5: Verify and commit**

```bash
cd apps/client && bunx tsc --noEmit && bun test src/
git add apps/client/src/components/ apps/client/src/stores/roomStore.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): integrate overlays into game and end screens"
```

---

## Task 11: Update E2E Tests

**Files:**
- Modify: `apps/client/tests/helpers/fixtures.ts`
- Modify: `apps/client/tests/helpers/multi-fixtures.ts`

- [ ] **Step 1: Ensure existing tests pass with alcohol disabled**

The alcohol config defaults to `enabled: false`, so existing tests should not be affected. Run:

```bash
bunx playwright test --reporter=line
```

- [ ] **Step 2: Fix any failures**

If any test breaks because of new imports or UI changes, fix it.

- [ ] **Step 3: Commit**

```bash
git add apps/client/tests/
LEFTHOOK_EXCLUDE=e2e git commit -m "test(e2e): ensure tests pass with alcohol mode disabled"
```
