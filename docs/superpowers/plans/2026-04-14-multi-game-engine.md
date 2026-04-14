# Multi-Device Game Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port game logic to the server for multi-device play — 3 modes (classic, chrono, voleur), scoring, timer, and end-of-game sync.

**Architecture:** Server-side game engine (`src/server/game-engine.ts`) takes over when the host starts a game. Client gets a `useMultiGame` hook and `MultiGameScreen`/`MultiEndScreen` components. Shared answer input components are reused.

**Tech Stack:** Bun WebSocket, React 19, Zustand (solo only), TanStack Query

**Spec:** `docs/superpowers/specs/2026-04-14-multi-game-engine-design.md`

**Test strategy:** After implementation, use the `/nightwatch` skill in explore + scenario + test mode to cartograph the MultiGameScreen and MultiEndScreen pages, discover UI scenarios, and generate Playwright E2E tests for multi-device flows.

---

## File Structure

### New files (server)

```
src/server/game-engine.ts       — startGame, submitAnswer, resolveRound, nextQuestion, endGame
```

### New files (client)

```
src/hooks/useMultiGame.ts        — extends useRoom with game messages (question, results, game_over)
src/components/MultiGameScreen.tsx — game UI for multi-device (uses shared answer inputs)
src/components/MultiEndScreen.tsx  — end screen for multi-device (uses shared ranking UI)
```

### Modified files

```
src/server/types.ts              — add GameState, game messages, QuestionWithoutAnswer, TurnResult, RankingEntry
src/server/ws.ts                 — add submit_answer handler, wire game engine
src/App.tsx                      — /game and /end route to multi components when room is active
```

---

## Task 1: Extend WS Types for Game Messages

**Files:**
- Modify: `apps/client/src/server/types.ts`

- [ ] **Step 1: Add game-related types and messages**

Add after the existing types in `apps/client/src/server/types.ts`:

```ts
// --- Game Engine Types ---

export interface QuestionWithoutAnswer {
  type: "qcm" | "vrai_faux" | "texte";
  text: string;
  choices?: string[];
  category: string;
}

export interface QuestionFull extends QuestionWithoutAnswer {
  answer: string;
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

export interface GameState {
  questions: QuestionFull[];
  currentQuestionIndex: number;
  currentPlayerIndex: number;
  scores: Record<string, number>;
  combos: Record<string, number>;
  answers: Map<string, string | boolean>;
  questionStartedAt: number;
  resolved: boolean;
}
```

Update the `Room` interface — add optional `game` field:

```ts
export interface Room {
  code: string;
  hostClerkId: string;
  players: Map<string, RoomPlayer>;
  status: "lobby" | "playing";
  packSlug: string | null;
  mode: GameMode | null;
  game: GameState | null; // added
}
```

Update `ClientMessage` — add `submit_answer`:

```ts
export type ClientMessage =
  | { type: "create_room" }
  | { type: "join_room"; code: string }
  | { type: "select_pack"; packSlug: string }
  | { type: "select_mode"; mode: GameMode }
  | { type: "start_game" }
  | { type: "leave_room" }
  | { type: "submit_answer"; answer: string | boolean }; // added
```

Update `ServerMessage` — add game messages:

```ts
export type ServerMessage =
  | { type: "room_created"; code: string }
  | { type: "room_joined"; room: RoomState }
  | { type: "player_joined"; player: PlayerInfo }
  | { type: "player_left"; clerkId: string }
  | { type: "player_disconnected"; clerkId: string }
  | { type: "player_reconnected"; clerkId: string }
  | { type: "host_changed"; clerkId: string }
  | { type: "pack_selected"; packSlug: string }
  | { type: "mode_selected"; mode: GameMode }
  | { type: "game_starting" }
  | { type: "error"; message: string }
  // Game messages (added)
  | { type: "question"; index: number; currentPlayerClerkId: string; question: QuestionWithoutAnswer; startsAt: number }
  | { type: "player_answered"; clerkId: string }
  | { type: "turn_result"; results: TurnResult }
  | { type: "game_over"; scores: Record<string, number>; rankings: RankingEntry[] };
```

- [ ] **Step 2: Update rooms.ts — add `game: null` to createRoom**

In `apps/client/src/server/rooms.ts`, in the `createRoom` function, add `game: null` to the room object.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/server/types.ts apps/client/src/server/rooms.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(ws): add game engine types and messages"
```

---

## Task 2: Game Engine (Server)

**Files:**
- Create: `apps/client/src/server/game-engine.ts`

- [ ] **Step 1: Create the game engine**

```ts
// apps/client/src/server/game-engine.ts
import { fetchPackQuestions } from "../lib/queries/questions";
import { checkAnswer } from "../utils/fuzzyMatch";
import {
  CHRONO_DURATION,
  CHRONO_TIMEOUT_PENALTY,
  MAX_COMBO,
  STEAL_FAIL_PENALTY,
  STEAL_GAIN,
  STEAL_LOSS,
} from "../types";
import { broadcast } from "./rooms";
import type {
  GameState,
  QuestionFull,
  QuestionWithoutAnswer,
  RankingEntry,
  Room,
  TurnResult,
} from "./types";

function toQuestionWithoutAnswer(q: QuestionFull): QuestionWithoutAnswer {
  return {
    type: q.type,
    text: q.text,
    choices: q.choices,
    category: q.category,
  };
}

function getConnectedPlayerIds(room: Room): string[] {
  return Array.from(room.players.values())
    .filter((p) => p.connected)
    .map((p) => p.clerkId);
}

function getNextConnectedPlayerIndex(room: Room, currentIndex: number): number {
  const playerIds = Array.from(room.players.keys());
  const total = playerIds.length;
  for (let offset = 1; offset <= total; offset++) {
    const idx = (currentIndex + offset) % total;
    const id = playerIds[idx];
    const player = room.players.get(id!);
    if (player?.connected) return idx;
  }
  return currentIndex;
}

function getCurrentPlayerId(room: Room): string {
  const ids = Array.from(room.players.keys());
  return ids[room.game!.currentPlayerIndex] ?? ids[0]!;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = tmp as T;
  }
  return shuffled;
}

export async function startGame(room: Room): Promise<void> {
  if (!room.packSlug) return;

  const rawQuestions = await fetchPackQuestions(room.packSlug);

  const questions: QuestionFull[] = shuffleArray(rawQuestions).map((q) => ({
    type: q.type as "qcm" | "vrai_faux" | "texte",
    text: q.question,
    choices: q.choices,
    answer: typeof q.answer === "boolean" ? String(q.answer) : q.answer,
    category: q.category,
  }));

  const scores: Record<string, number> = {};
  const combos: Record<string, number> = {};
  for (const id of room.players.keys()) {
    scores[id] = 0;
    combos[id] = 0;
  }

  room.game = {
    questions,
    currentQuestionIndex: 0,
    currentPlayerIndex: 0,
    scores,
    combos,
    answers: new Map(),
    questionStartedAt: 0,
    resolved: false,
  };

  sendQuestion(room);
}

function sendQuestion(room: Room): void {
  const game = room.game!;
  const question = game.questions[game.currentQuestionIndex];
  if (!question) {
    endGame(room);
    return;
  }

  game.answers.clear();
  game.resolved = false;
  game.questionStartedAt = Date.now();

  const currentPlayerId = getCurrentPlayerId(room);

  broadcast(room, {
    type: "question",
    index: game.currentQuestionIndex,
    currentPlayerClerkId: currentPlayerId,
    question: toQuestionWithoutAnswer(question),
    startsAt: game.questionStartedAt,
  });

  // Chrono timeout
  if (room.mode === "chrono") {
    setTimeout(() => {
      if (game.resolved || game.currentQuestionIndex !== room.game?.currentQuestionIndex) return;
      const playerId = currentPlayerId;
      if (!game.answers.has(playerId)) {
        handleChronoTimeout(room, playerId);
      }
    }, CHRONO_DURATION * 1000);
  }
}

function handleChronoTimeout(room: Room, playerId: string): void {
  const game = room.game!;
  if (game.resolved) return;

  game.combos[playerId] = 0;
  game.scores[playerId] = (game.scores[playerId] ?? 0) - CHRONO_TIMEOUT_PENALTY;
  game.resolved = true;

  const question = game.questions[game.currentQuestionIndex]!;

  const results: TurnResult = {
    correctAnswer: question.type === "vrai_faux" ? question.answer === "true" : question.answer,
    playerResults: [{
      clerkId: playerId,
      answered: false,
      correct: false,
      stole: false,
      pointsDelta: -CHRONO_TIMEOUT_PENALTY,
    }],
    scores: { ...game.scores },
    combos: { ...game.combos },
  };

  broadcast(room, { type: "turn_result", results });
  scheduleNextQuestion(room);
}

export function submitAnswer(room: Room, clerkId: string, answer: string | boolean): void {
  const game = room.game;
  if (!game || game.resolved) return;

  // Already answered this round
  if (game.answers.has(clerkId)) return;

  game.answers.set(clerkId, answer);

  // Broadcast that this player answered (without revealing result)
  broadcast(room, { type: "player_answered", clerkId });

  // Check if round should resolve
  if (room.mode === "voleur") {
    resolveVoleur(room);
  } else {
    // Classic / Chrono: only the current player answers
    const currentPlayerId = getCurrentPlayerId(room);
    if (clerkId === currentPlayerId) {
      resolveClassicOrChrono(room);
    }
  }
}

function resolveClassicOrChrono(room: Room): void {
  const game = room.game!;
  const question = game.questions[game.currentQuestionIndex]!;
  const playerId = getCurrentPlayerId(room);
  const answer = game.answers.get(playerId);

  if (answer === undefined) return;

  const correct = checkAnswer(answer, { type: question.type, answer: question.type === "vrai_faux" ? question.answer === "true" : question.answer });

  if (correct) {
    const combo = Math.min((game.combos[playerId] ?? 0) + 1, MAX_COMBO);
    game.combos[playerId] = combo;
    const points = 1 + (combo - 1) * 0.5;
    game.scores[playerId] = (game.scores[playerId] ?? 0) + points;
  } else {
    game.combos[playerId] = 0;
  }

  game.resolved = true;

  const correctAnswer = question.type === "vrai_faux" ? question.answer === "true" : question.answer;
  const pointsDelta = correct ? 1 + (Math.min((game.combos[playerId] ?? 1), MAX_COMBO) - 1) * 0.5 : 0;

  const results: TurnResult = {
    correctAnswer,
    playerResults: [{
      clerkId: playerId,
      answered: true,
      correct,
      stole: false,
      pointsDelta: correct ? pointsDelta : 0,
    }],
    scores: { ...game.scores },
    combos: { ...game.combos },
  };

  broadcast(room, { type: "turn_result", results });
  scheduleNextQuestion(room);
}

function resolveVoleur(room: Room): void {
  const game = room.game!;
  const question = game.questions[game.currentQuestionIndex]!;
  const currentPlayerId = getCurrentPlayerId(room);
  const connectedIds = getConnectedPlayerIds(room);

  // Check if current player has answered
  const mainAnswer = game.answers.get(currentPlayerId);
  if (mainAnswer === undefined) return; // Main player hasn't answered yet

  // Check if a stealer answered correctly
  let stealerWon: string | null = null;
  for (const [id, ans] of game.answers) {
    if (id === currentPlayerId) continue;
    const correct = checkAnswer(ans, { type: question.type, answer: question.type === "vrai_faux" ? question.answer === "true" : question.answer });
    if (correct) {
      stealerWon = id;
      break; // First correct stealer wins
    }
  }

  // Check if all connected players have answered (or only main + stealerWon)
  const otherIds = connectedIds.filter((id) => id !== currentPlayerId);
  const allOthersAnswered = otherIds.every((id) => game.answers.has(id));

  // Resolve only if: stealer won OR all others have tried OR main answered
  if (!stealerWon && !allOthersAnswered) return;

  // Now resolve
  game.resolved = true;

  const mainCorrect = checkAnswer(mainAnswer, { type: question.type, answer: question.type === "vrai_faux" ? question.answer === "true" : question.answer });

  const playerResults = [];

  // Main player result
  if (mainCorrect && !stealerWon) {
    const combo = Math.min((game.combos[currentPlayerId] ?? 0) + 1, MAX_COMBO);
    game.combos[currentPlayerId] = combo;
    const points = 1 + (combo - 1) * 0.5;
    game.scores[currentPlayerId] = (game.scores[currentPlayerId] ?? 0) + points;
    playerResults.push({ clerkId: currentPlayerId, answered: true, correct: true, stole: false, pointsDelta: points });
  } else if (stealerWon) {
    game.scores[currentPlayerId] = (game.scores[currentPlayerId] ?? 0) - STEAL_LOSS;
    game.combos[currentPlayerId] = 0;
    playerResults.push({ clerkId: currentPlayerId, answered: true, correct: mainCorrect, stole: false, pointsDelta: -STEAL_LOSS });
  } else {
    game.combos[currentPlayerId] = 0;
    playerResults.push({ clerkId: currentPlayerId, answered: true, correct: false, stole: false, pointsDelta: 0 });
  }

  // Other players results
  for (const id of otherIds) {
    const ans = game.answers.get(id);
    if (ans === undefined) {
      playerResults.push({ clerkId: id, answered: false, correct: false, stole: false, pointsDelta: 0 });
      continue;
    }
    const correct = checkAnswer(ans, { type: question.type, answer: question.type === "vrai_faux" ? question.answer === "true" : question.answer });
    if (id === stealerWon) {
      game.scores[id] = (game.scores[id] ?? 0) + STEAL_GAIN;
      playerResults.push({ clerkId: id, answered: true, correct: true, stole: true, pointsDelta: STEAL_GAIN });
    } else if (!correct) {
      game.scores[id] = (game.scores[id] ?? 0) - STEAL_FAIL_PENALTY;
      game.combos[id] = 0;
      playerResults.push({ clerkId: id, answered: true, correct: false, stole: false, pointsDelta: -STEAL_FAIL_PENALTY });
    } else {
      // Correct but someone else stole first
      playerResults.push({ clerkId: id, answered: true, correct: true, stole: false, pointsDelta: 0 });
    }
  }

  const correctAnswer = question.type === "vrai_faux" ? question.answer === "true" : question.answer;

  const results: TurnResult = {
    correctAnswer,
    playerResults,
    scores: { ...game.scores },
    combos: { ...game.combos },
  };

  broadcast(room, { type: "turn_result", results });
  scheduleNextQuestion(room);
}

function scheduleNextQuestion(room: Room): void {
  setTimeout(() => {
    const game = room.game;
    if (!game) return;
    game.currentQuestionIndex++;
    if (game.currentQuestionIndex >= game.questions.length) {
      endGame(room);
      return;
    }
    game.currentPlayerIndex = getNextConnectedPlayerIndex(room, game.currentPlayerIndex);
    sendQuestion(room);
  }, 3000);
}

function endGame(room: Room): void {
  const game = room.game;
  if (!game) return;

  const rankings: RankingEntry[] = Array.from(room.players.values())
    .map((p) => ({
      clerkId: p.clerkId,
      username: p.username,
      score: game.scores[p.clerkId] ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  broadcast(room, {
    type: "game_over",
    scores: { ...game.scores },
    rankings,
  });

  room.status = "lobby";
  room.game = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/server/game-engine.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(ws): add server-side game engine (classic, chrono, voleur)"
```

---

## Task 3: Wire Game Engine into WS Handlers

**Files:**
- Modify: `apps/client/src/server/ws.ts`

- [ ] **Step 1: Update ws.ts**

Add import at top:
```ts
import { startGame as startGameEngine, submitAnswer as submitAnswerEngine } from "./game-engine";
```

In the `start_game` case, after `broadcast(room, { type: "game_starting" });`, add:
```ts
await startGameEngine(room);
```

Make `handleMessage` async (change `function handleMessage` to `async function handleMessage`).

Add a new case in the switch:
```ts
case "submit_answer": {
  const room = findRoomByPlayer(clerkId);
  if (!room || !room.game) {
    send(ws, { type: "error", message: "Pas de partie en cours" });
    return;
  }
  submitAnswerEngine(room, clerkId, msg.answer);
  break;
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd apps/client && bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/server/ws.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(ws): wire game engine into WS message handlers"
```

---

## Task 4: useMultiGame Hook

**Files:**
- Create: `apps/client/src/hooks/useMultiGame.ts`

- [ ] **Step 1: Create the hook**

This hook extends `useRoom` by adding game-specific state from WS messages.

```ts
// apps/client/src/hooks/useMultiGame.ts
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameMode } from "../types";

interface PlayerInfo {
  clerkId: string;
  username: string;
  gender: "homme" | "femme";
  connected: boolean;
}

interface QuestionWithoutAnswer {
  type: "qcm" | "vrai_faux" | "texte";
  text: string;
  choices?: string[];
  category: string;
}

interface PlayerResult {
  clerkId: string;
  answered: boolean;
  correct: boolean;
  stole: boolean;
  pointsDelta: number;
}

interface TurnResult {
  correctAnswer: string | boolean;
  playerResults: PlayerResult[];
  scores: Record<string, number>;
  combos: Record<string, number>;
}

interface RankingEntry {
  clerkId: string;
  username: string;
  score: number;
  rank: number;
}

interface MultiGameState {
  question: QuestionWithoutAnswer | null;
  questionIndex: number;
  currentPlayerClerkId: string | null;
  startsAt: number;
  answeredPlayers: Set<string>;
  turnResult: TurnResult | null;
  gameOver: { scores: Record<string, number>; rankings: RankingEntry[] } | null;
  scores: Record<string, number>;
  combos: Record<string, number>;
  hasAnswered: boolean;
}

export function useMultiGame() {
  const { userId } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<{ code: string; hostClerkId: string; players: PlayerInfo[]; status: string; packSlug: string | null; mode: GameMode | null } | null>(null);
  const [game, setGame] = useState<MultiGameState>({
    question: null,
    questionIndex: 0,
    currentPlayerClerkId: null,
    startsAt: 0,
    answeredPlayers: new Set(),
    turnResult: null,
    gameOver: null,
    scores: {},
    combos: {},
    hasAnswered: false,
  });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => { setConnected(true); setError(null); };
    ws.onclose = () => { setConnected(false); wsRef.current = null; };
    ws.onerror = () => { setError("Connexion perdue"); setConnected(false); };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        // Room messages
        case "room_joined":
          setRoom(msg.room);
          setError(null);
          break;
        case "player_joined":
          setRoom((prev) => prev ? { ...prev, players: [...prev.players, msg.player] } : prev);
          break;
        case "player_left":
          setRoom((prev) => prev ? { ...prev, players: prev.players.filter((p: PlayerInfo) => p.clerkId !== msg.clerkId) } : prev);
          break;
        case "player_disconnected":
          setRoom((prev) => prev ? { ...prev, players: prev.players.map((p: PlayerInfo) => p.clerkId === msg.clerkId ? { ...p, connected: false } : p) } : prev);
          break;
        case "player_reconnected":
          setRoom((prev) => prev ? { ...prev, players: prev.players.map((p: PlayerInfo) => p.clerkId === msg.clerkId ? { ...p, connected: true } : p) } : prev);
          break;
        case "host_changed":
          setRoom((prev) => prev ? { ...prev, hostClerkId: msg.clerkId } : prev);
          break;
        case "pack_selected":
          setRoom((prev) => prev ? { ...prev, packSlug: msg.packSlug } : prev);
          break;
        case "mode_selected":
          setRoom((prev) => prev ? { ...prev, mode: msg.mode } : prev);
          break;

        // Game messages
        case "question":
          setGame({
            question: msg.question,
            questionIndex: msg.index,
            currentPlayerClerkId: msg.currentPlayerClerkId,
            startsAt: msg.startsAt,
            answeredPlayers: new Set(),
            turnResult: null,
            gameOver: null,
            scores: game.scores,
            combos: game.combos,
            hasAnswered: false,
          });
          break;
        case "player_answered":
          setGame((prev) => {
            const updated = new Set(prev.answeredPlayers);
            updated.add(msg.clerkId);
            return { ...prev, answeredPlayers: updated };
          });
          break;
        case "turn_result":
          setGame((prev) => ({
            ...prev,
            turnResult: msg.results,
            scores: msg.results.scores,
            combos: msg.results.combos,
          }));
          break;
        case "game_over":
          setGame((prev) => ({
            ...prev,
            gameOver: { scores: msg.scores, rankings: msg.rankings },
          }));
          break;
        case "error":
          setError(msg.message);
          break;
      }
    };
  }, [game.scores, game.combos]);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const submitAnswer = useCallback((answer: string | boolean) => {
    sendMessage({ type: "submit_answer", answer });
    setGame((prev) => ({ ...prev, hasAnswered: true }));
  }, [sendMessage]);

  const joinRoom = useCallback((code: string) => {
    connect();
    const check = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: "join_room", code });
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  }, [connect, sendMessage]);

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  const isMyTurn = game.currentPlayerClerkId === userId;
  const isHost = room?.hostClerkId === userId;

  return {
    room,
    game,
    connected,
    error,
    isHost,
    isMyTurn,
    submitAnswer,
    joinRoom,
    sendMessage,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/hooks/useMultiGame.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(client): add useMultiGame hook for multi-device game state"
```

---

## Task 5: MultiGameScreen Component

**Files:**
- Create: `apps/client/src/components/MultiGameScreen.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/client/src/components/MultiGameScreen.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { QcmChoices, TextInput, VraiFaux } from "./AnswerInputs";
import { Feedback } from "./Feedback";
import { ScoreBoard } from "./ScoreBoard";
import { useMultiGame } from "../hooks/useMultiGame";
import { CHRONO_DURATION } from "../types";
import type { Player } from "../types";

export function MultiGameScreen() {
  const navigate = useNavigate();
  const { room, game, isMyTurn, submitAnswer } = useMultiGame();
  const [timeLeft, setTimeLeft] = useState(CHRONO_DURATION);

  // Chrono countdown (local, from startsAt)
  useEffect(() => {
    if (room?.mode !== "chrono" || !game.startsAt) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - game.startsAt) / 1000;
      const remaining = Math.max(0, CHRONO_DURATION - elapsed);
      setTimeLeft(Math.ceil(remaining));
      if (remaining <= 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [game.startsAt, room?.mode]);

  // Navigate to /end on game over
  useEffect(() => {
    if (game.gameOver) {
      navigate("/end");
    }
  }, [game.gameOver, navigate]);

  if (!game.question || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  const question = game.question;
  const isVoleur = room.mode === "voleur";
  const isChrono = room.mode === "chrono";
  const inputsEnabled = isVoleur ? !game.hasAnswered : isMyTurn && !game.hasAnswered;
  const currentPlayerName = room.players.find((p) => p.clerkId === game.currentPlayerClerkId)?.username ?? "";
  const showFeedback = game.turnResult !== null;

  // Build players array for ScoreBoard
  const players: Player[] = room.players.map((p) => ({ name: p.username, gender: p.gender }));

  return (
    <div className="min-h-screen p-4 pt-8 max-w-2xl mx-auto">
      {/* Question counter */}
      <div className="text-center mb-2">
        <span className="text-sm text-muted-foreground">
          Question {game.questionIndex + 1}
        </span>
        <Badge variant="secondary" className="ml-2 text-xs">
          {question.category}
        </Badge>
      </div>

      {/* Chrono timer */}
      {isChrono && isMyTurn && (
        <div className="mb-4">
          <Progress value={(timeLeft / CHRONO_DURATION) * 100} className="h-2" />
          <div className="text-center mt-1">
            <Badge variant={timeLeft <= 5 ? "destructive" : "secondary"} className="animate-pulse">
              {timeLeft}s
            </Badge>
          </div>
        </div>
      )}

      {/* Current player indicator */}
      {!isVoleur && (
        <div className="text-center mb-4">
          <span className={`text-sm ${isMyTurn ? "text-party-green font-bold" : "text-muted-foreground"}`}>
            {isMyTurn ? "C'est ton tour !" : `C'est au tour de ${currentPlayerName}`}
          </span>
        </div>
      )}

      {/* Question text */}
      <p className="text-xl font-semibold text-center mb-6">{question.text}</p>

      {/* Answer inputs */}
      {!showFeedback && (
        <div className="mb-6">
          {question.type === "qcm" && question.choices && (
            <QcmChoices
              choices={question.choices}
              disabled={!inputsEnabled}
              onSelect={(choice) => submitAnswer(choice)}
            />
          )}
          {question.type === "vrai_faux" && (
            <VraiFaux
              disabled={!inputsEnabled}
              onSelect={(val) => submitAnswer(val)}
            />
          )}
          {question.type === "texte" && (
            <TextInput
              disabled={!inputsEnabled}
              onSubmit={(val) => submitAnswer(val)}
            />
          )}
        </div>
      )}

      {/* Who answered (voleur mode) */}
      {isVoleur && !showFeedback && game.answeredPlayers.size > 0 && (
        <div className="text-center mb-4 space-x-2">
          {Array.from(game.answeredPlayers).map((id) => {
            const name = room.players.find((p) => p.clerkId === id)?.username ?? "?";
            return (
              <Badge key={id} variant="secondary" className="text-xs">
                {name} a répondu
              </Badge>
            );
          })}
        </div>
      )}

      {/* Turn result feedback */}
      {showFeedback && game.turnResult && (
        <div className="mb-6 text-center animate-bounce-in">
          <p className="text-lg font-bold mb-2">
            Réponse : {String(game.turnResult.correctAnswer)}
          </p>
          <div className="space-y-1">
            {game.turnResult.playerResults.filter((r) => r.answered).map((r) => {
              const name = room.players.find((p) => p.clerkId === r.clerkId)?.username ?? "?";
              return (
                <p key={r.clerkId} className={`text-sm ${r.correct ? "text-party-green" : "text-destructive"}`}>
                  {name}: {r.correct ? "✓" : "✗"} {r.stole ? "(vol !)" : ""} {r.pointsDelta > 0 ? `+${r.pointsDelta}` : r.pointsDelta < 0 ? `${r.pointsDelta}` : ""}
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* Scoreboard */}
      <ScoreBoard
        players={players}
        scores={game.scores}
        combos={game.combos}
        currentPlayerIndex={room.players.findIndex((p) => p.clerkId === game.currentPlayerClerkId)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/components/MultiGameScreen.tsx
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(client): add MultiGameScreen for multi-device play"
```

---

## Task 6: MultiEndScreen Component

**Files:**
- Create: `apps/client/src/components/MultiEndScreen.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/client/src/components/MultiEndScreen.tsx
import { Crown, Medal, Trophy } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { fireGameEnd } from "../utils/confetti";
import { useMultiGame } from "../hooks/useMultiGame";

export function MultiEndScreen() {
  const navigate = useNavigate();
  const { game, room } = useMultiGame();

  useEffect(() => {
    fireGameEnd();
  }, []);

  if (!game.gameOver) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  const { rankings } = game.gameOver;
  const medalIcons = [
    <Trophy key="1" className="w-6 h-6 text-yellow-400" />,
    <Medal key="2" className="w-6 h-6 text-gray-400" />,
    <Medal key="3" className="w-6 h-6 text-amber-600" />,
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <h1 className="text-3xl font-bold text-center text-glow-pink animate-bounce-in">
          Fin de la partie !
        </h1>

        <div className="space-y-3">
          {rankings.map((entry, i) => (
            <div
              key={entry.clerkId}
              className={`flex items-center gap-4 p-4 rounded-xl ${
                i === 0 ? "bg-yellow-500/10 ring-2 ring-yellow-500/30 glow-purple" : "bg-card/50"
              } ${i === 0 ? "animate-bounce-in" : ""}`}
            >
              <div className="w-8 text-center">
                {i < 3 ? medalIcons[i] : <span className="text-muted-foreground">{entry.rank}</span>}
              </div>
              <div className="flex-1">
                <p className={`font-bold ${i === 0 ? "text-glow-pink" : ""}`}>
                  {entry.username}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold">{entry.score}</span>
                <span className="text-sm text-muted-foreground ml-1">pts</span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-4">
          <Button
            size="lg"
            onClick={() => navigate("/play")}
            className="glow-purple"
          >
            Nouvelle partie
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/components/MultiEndScreen.tsx
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(client): add MultiEndScreen for multi-device results"
```

---

## Task 7: Update App.tsx Routing for Multi Game/End

**Files:**
- Modify: `apps/client/src/App.tsx`

- [ ] **Step 1: Update /game and /end routes**

Read `apps/client/src/App.tsx`. Add imports:
```tsx
import { MultiGameScreen } from "./components/MultiGameScreen";
import { MultiEndScreen } from "./components/MultiEndScreen";
```

Create wrapper components that decide which screen to show:

```tsx
function GameRoute() {
  const { room } = useRoom();
  return room ? <MultiGameScreen /> : <GameScreen />;
}

function EndRoute() {
  const { room } = useRoom();
  // If room exists and game_over data is available, show multi end
  // Otherwise show solo end
  return room ? <MultiEndScreen /> : <EndScreen />;
}
```

Replace the `/game` and `/end` route elements:

```tsx
<Route path="/game" element={<AuthGuard><InGameHeader /><GameRoute /></AuthGuard>} />
<Route path="/end" element={<AuthGuard><InGameHeader /><EndRoute /></AuthGuard>} />
```

- [ ] **Step 2: Verify types and tests**

```bash
cd apps/client && bunx tsc --noEmit && bun test src/
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/App.tsx
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(client): route /game and /end to multi components when room active"
```

---

## Task 8: Update E2E Tests

**Files:**
- Modify: `apps/client/tests/helpers/fixtures.ts` (if needed)

- [ ] **Step 1: Run existing E2E tests**

```bash
cd apps/client && bunx playwright test
```

The solo game tests should still pass since they navigate to `/play/solo` and use the existing GameScreen/EndScreen.

- [ ] **Step 2: Fix any failures**

If any test fails due to import issues or routing changes, fix it.

- [ ] **Step 3: Commit (if changes needed)**

```bash
git add apps/client/tests/
LEFTHOOK_EXCLUDE=e2e git commit -m "test(e2e): fix tests after game engine integration"
```

---

## Task 9: Test Strategy with /nightwatch

After all tasks are implemented and passing:

- [ ] **Step 1: Use /nightwatch explore mode** on `/game` to cartograph the MultiGameScreen — zones, interactions, states
- [ ] **Step 2: Use /nightwatch explore mode** on `/end` to cartograph the MultiEndScreen
- [ ] **Step 3: Use /nightwatch scenario mode** to design test scenarios for multi-device game flows
- [ ] **Step 4: Use /nightwatch test mode** to generate Playwright E2E tests

This requires a running full stack (Strapi + client + 2 browser contexts to simulate 2 players). The nightwatch skill will guide the exploration and test generation process.

**Note:** Multi-device E2E tests need 2 simultaneous browser contexts connected to the same room — this is a Playwright `browser.newContext()` pattern, not a standard single-page test.
