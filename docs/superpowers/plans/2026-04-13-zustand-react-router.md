# Zustand + React Router Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic `useGameState` hook with Zustand stores and add react-router-dom for URL-based navigation, with zero feature changes.

**Architecture:** Three Zustand stores (`playerStore`, `packStore`, `gameStore`) replace the single 490-line hook. A router reference module lets stores call `navigate()` outside React. Three routes (`/`, `/game`, `/end`) replace the `screen` state variable. Sub-components keep their props-based interface.

**Tech Stack:** Zustand, react-router-dom, Bun (runtime/test/build)

**Spec:** `docs/superpowers/specs/2026-04-13-zustand-react-router-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/client/src/stores/router.ts` | Create | Navigate ref for stores |
| `apps/client/src/stores/playerStore.ts` | Create | Player list management |
| `apps/client/src/stores/packStore.ts` | Create | Pack selection + finished tracking |
| `apps/client/src/stores/gameStore.ts` | Create | Game logic, scores, timer, feedback |
| `apps/client/src/App.tsx` | Rewrite | BrowserRouter + Routes |
| `apps/client/src/components/HomeScreen.tsx` | Rewrite | Use stores instead of props |
| `apps/client/src/components/GameScreen.tsx` | Rewrite | Use stores instead of props |
| `apps/client/src/components/EndScreen.tsx` | Rewrite | Use stores instead of props |
| `apps/client/src/types.ts` | Modify | Remove `Screen` type |
| `apps/client/src/hooks/useGameState.ts` | Delete | Replaced by stores |
| `apps/client/src/index.tsx` | No change | |
| `apps/client/src/components/AnswerInputs.tsx` | No change | |
| `apps/client/src/components/Feedback.tsx` | No change | |
| `apps/client/src/components/ScoreBoard.tsx` | No change | |
| `apps/client/src/components/StealZone.tsx` | No change | |
| `apps/client/src/utils/*` | No change | |

---

### Task 1: Install dependencies

**Files:**
- Modify: `apps/client/package.json`

- [ ] **Step 1: Install zustand and react-router-dom**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && bun add --cwd apps/client zustand react-router-dom
```

- [ ] **Step 2: Verify install**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && bun run build
```

Expected: Build succeeds (no code changes yet, just new deps).

- [ ] **Step 3: Commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add apps/client/package.json bun.lock
git commit -m "deps: add zustand and react-router-dom"
```

---

### Task 2: Create router reference module

**Files:**
- Create: `apps/client/src/stores/router.ts`

- [ ] **Step 1: Create the router ref**

```ts
// apps/client/src/stores/router.ts
import type { NavigateFunction } from "react-router-dom";

let _navigate: NavigateFunction = () => {};

export const setNavigate = (fn: NavigateFunction) => {
  _navigate = fn;
};

export const getNavigate = () => _navigate;
```

- [ ] **Step 2: Commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add apps/client/src/stores/router.ts
git commit -m "feat: add router navigate reference for stores"
```

---

### Task 3: Create playerStore

**Files:**
- Create: `apps/client/src/stores/playerStore.ts`
- Test: `apps/client/src/stores/playerStore.test.ts`

- [ ] **Step 1: Write the test**

```ts
// apps/client/src/stores/playerStore.test.ts
import { test, expect, beforeEach } from "bun:test";
import { usePlayerStore } from "./playerStore";

beforeEach(() => {
  usePlayerStore.getState().resetPlayers();
});

test("addPlayer adds a player and returns true", () => {
  const result = usePlayerStore.getState().addPlayer("Alice");
  expect(result).toBe(true);
  expect(usePlayerStore.getState().players).toEqual(["Alice"]);
});

test("addPlayer trims whitespace", () => {
  usePlayerStore.getState().addPlayer("  Bob  ");
  expect(usePlayerStore.getState().players).toEqual(["Bob"]);
});

test("addPlayer rejects empty string", () => {
  const result = usePlayerStore.getState().addPlayer("   ");
  expect(result).toBe(false);
  expect(usePlayerStore.getState().players).toEqual([]);
});

test("addPlayer rejects duplicate name", () => {
  usePlayerStore.getState().addPlayer("Alice");
  const result = usePlayerStore.getState().addPlayer("Alice");
  expect(result).toBe(false);
  expect(usePlayerStore.getState().players).toEqual(["Alice"]);
});

test("removePlayer removes a player", () => {
  usePlayerStore.getState().addPlayer("Alice");
  usePlayerStore.getState().addPlayer("Bob");
  usePlayerStore.getState().removePlayer("Alice");
  expect(usePlayerStore.getState().players).toEqual(["Bob"]);
});

test("resetPlayers clears all players", () => {
  usePlayerStore.getState().addPlayer("Alice");
  usePlayerStore.getState().addPlayer("Bob");
  usePlayerStore.getState().resetPlayers();
  expect(usePlayerStore.getState().players).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && bun test apps/client/src/stores/playerStore.test.ts
```

Expected: FAIL — `Cannot find module "./playerStore"`

- [ ] **Step 3: Implement playerStore**

```ts
// apps/client/src/stores/playerStore.ts
import { create } from "zustand";

interface PlayerState {
  players: string[];
  addPlayer: (name: string) => boolean;
  removePlayer: (name: string) => void;
  resetPlayers: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  players: [],

  addPlayer: (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || get().players.includes(trimmed)) return false;
    set((s) => ({ players: [...s.players, trimmed] }));
    return true;
  },

  removePlayer: (name: string) => {
    set((s) => ({ players: s.players.filter((p) => p !== name) }));
  },

  resetPlayers: () => {
    set({ players: [] });
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && bun test apps/client/src/stores/playerStore.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add apps/client/src/stores/playerStore.ts apps/client/src/stores/playerStore.test.ts
git commit -m "feat: add playerStore with tests"
```

---

### Task 4: Create packStore

**Files:**
- Create: `apps/client/src/stores/packStore.ts`
- Test: `apps/client/src/stores/packStore.test.ts`

- [ ] **Step 1: Write the test**

```ts
// apps/client/src/stores/packStore.test.ts
import { test, expect, beforeEach, mock } from "bun:test";
import { usePackStore } from "./packStore";

// Mock localStorage
const storage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { for (const k in storage) delete storage[k]; },
  length: 0,
  key: () => null,
};

beforeEach(() => {
  localStorage.clear();
  usePackStore.getState().reset();
});

test("selectChunk sets selectedChunk", () => {
  usePackStore.getState().selectChunk("questions-1.json");
  expect(usePackStore.getState().selectedChunk).toBe("questions-1.json");
});

test("markFinished adds chunk to finishedChunks and persists", () => {
  usePackStore.getState().markFinished("questions-1.json");
  expect(usePackStore.getState().finishedChunks).toContain("questions-1.json");
  const stored = JSON.parse(localStorage.getItem("quiz-finished-chunks") || "[]");
  expect(stored).toContain("questions-1.json");
});

test("markFinished does not duplicate", () => {
  usePackStore.getState().markFinished("questions-1.json");
  usePackStore.getState().markFinished("questions-1.json");
  expect(usePackStore.getState().finishedChunks).toEqual(["questions-1.json"]);
});

test("reset clears selectedChunk but keeps finishedChunks", () => {
  usePackStore.getState().selectChunk("questions-2.json");
  usePackStore.getState().markFinished("questions-1.json");
  usePackStore.getState().reset();
  expect(usePackStore.getState().selectedChunk).toBeNull();
  expect(usePackStore.getState().finishedChunks).toContain("questions-1.json");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && bun test apps/client/src/stores/packStore.test.ts
```

Expected: FAIL — `Cannot find module "./packStore"`

- [ ] **Step 3: Implement packStore**

```ts
// apps/client/src/stores/packStore.ts
import { create } from "zustand";

const FINISHED_KEY = "quiz-finished-chunks";

function loadFinished(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FINISHED_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

interface PackState {
  selectedChunk: string | null;
  finishedChunks: string[];
  selectChunk: (chunk: string) => void;
  markFinished: (chunk: string) => void;
  reset: () => void;
}

export const usePackStore = create<PackState>((set, get) => ({
  selectedChunk: null,
  finishedChunks: loadFinished(),

  selectChunk: (chunk: string) => {
    set({ selectedChunk: chunk });
  },

  markFinished: (chunk: string) => {
    const current = get().finishedChunks;
    if (current.includes(chunk)) return;
    const updated = [...current, chunk];
    localStorage.setItem(FINISHED_KEY, JSON.stringify(updated));
    set({ finishedChunks: updated });
  },

  reset: () => {
    set({ selectedChunk: null, finishedChunks: loadFinished() });
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && bun test apps/client/src/stores/packStore.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add apps/client/src/stores/packStore.ts apps/client/src/stores/packStore.test.ts
git commit -m "feat: add packStore with tests"
```

---

### Task 5: Create gameStore

**Files:**
- Create: `apps/client/src/stores/gameStore.ts`
- Test: `apps/client/src/stores/gameStore.test.ts`

This is the largest store. It contains all game logic previously in `useGameState`.

- [ ] **Step 1: Write the test**

```ts
// apps/client/src/stores/gameStore.test.ts
import { test, expect, beforeEach, mock } from "bun:test";
import { useGameStore } from "./gameStore";
import { usePlayerStore } from "./playerStore";
import { usePackStore } from "./packStore";

// Mock localStorage
const storage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { for (const k in storage) delete storage[k]; },
  length: 0,
  key: () => null,
};

// Mock navigate
import { setNavigate } from "./router";
const navigatedTo: string[] = [];
setNavigate((path: string | number) => { navigatedTo.push(String(path)); });

// Mock fetch for startGame
const mockQuestions = {
  "Histoire": [
    { type: "qcm", question: "Q1?", choices: ["A", "B", "C", "D"], answer: "A" },
    { type: "texte", question: "Q2?", answer: "Paris" },
  ],
};

globalThis.fetch = mock(() =>
  Promise.resolve(new Response(JSON.stringify(mockQuestions)))
) as any;

// Mock sounds
mock.module("../utils/sounds", () => ({
  sounds: { win: () => {}, fail: () => {}, steal: () => {} },
}));

beforeEach(() => {
  navigatedTo.length = 0;
  localStorage.clear();
  useGameStore.getState().reset();
  usePlayerStore.getState().resetPlayers();
  usePackStore.getState().reset();
});

test("startGame loads questions, inits scores, navigates to /game", async () => {
  usePlayerStore.getState().addPlayer("Alice");
  usePlayerStore.getState().addPlayer("Bob");

  await useGameStore.getState().startGame("questions-1.json", "classic");

  const state = useGameStore.getState();
  expect(state.questions.length).toBe(2);
  expect(state.scores["Alice"]).toBe(0);
  expect(state.scores["Bob"]).toBe(0);
  expect(state.combos["Alice"]).toBe(0);
  expect(state.currentQuestionIndex).toBe(0);
  expect(state.gameMode).toBe("classic");
  expect(navigatedTo).toContain("/game");
});

test("submitAnswer correct increments score and combo", async () => {
  usePlayerStore.getState().addPlayer("Alice");
  await useGameStore.getState().startGame("questions-1.json", "classic");

  // Find the QCM question and submit correct answer
  const state = useGameStore.getState();
  const q = state.questions[state.currentQuestionIndex]!;
  if (q.type === "qcm") {
    useGameStore.getState().submitAnswer(String(q.answer));
  } else {
    useGameStore.getState().submitAnswer(String(q.answer));
  }

  const after = useGameStore.getState();
  expect(after.answered).toBe(true);
  expect(after.scores["Alice"]).toBeGreaterThan(0);
  expect(after.feedback.type).toBe("success");
});

test("submitAnswer incorrect sets combo to 0", async () => {
  usePlayerStore.getState().addPlayer("Alice");
  await useGameStore.getState().startGame("questions-1.json", "classic");

  useGameStore.getState().submitAnswer("WRONG_ANSWER_XYZ");

  const after = useGameStore.getState();
  expect(after.answered).toBe(true);
  expect(after.combos["Alice"]).toBe(0);
  expect(after.feedback.type).toBe("error");
});

test("nextQuestion advances index and player", async () => {
  usePlayerStore.getState().addPlayer("Alice");
  usePlayerStore.getState().addPlayer("Bob");
  await useGameStore.getState().startGame("questions-1.json", "classic");

  useGameStore.getState().submitAnswer("whatever");
  useGameStore.getState().nextQuestion();

  const after = useGameStore.getState();
  expect(after.currentQuestionIndex).toBe(1);
  expect(after.currentPlayerIndex).toBe(1);
  expect(after.answered).toBe(false);
});

test("nextQuestion navigates to /end when questions exhausted", async () => {
  usePlayerStore.getState().addPlayer("Alice");
  await useGameStore.getState().startGame("questions-1.json", "classic");

  // Answer and skip all questions
  useGameStore.getState().submitAnswer("x");
  useGameStore.getState().nextQuestion();
  useGameStore.getState().submitAnswer("x");
  useGameStore.getState().nextQuestion();

  expect(navigatedTo).toContain("/end");
});

test("forcePoint awards points with combo", async () => {
  usePlayerStore.getState().addPlayer("Alice");
  await useGameStore.getState().startGame("questions-1.json", "classic");

  useGameStore.getState().submitAnswer("WRONG");
  useGameStore.getState().forcePoint();

  const after = useGameStore.getState();
  expect(after.scores["Alice"]).toBe(1);
  expect(after.combos["Alice"]).toBe(1);
});

test("reset clears all game state and navigates to /", async () => {
  usePlayerStore.getState().addPlayer("Alice");
  await useGameStore.getState().startGame("questions-1.json", "classic");

  useGameStore.getState().reset();

  const after = useGameStore.getState();
  expect(after.questions).toEqual([]);
  expect(after.scores).toEqual({});
  expect(after.currentQuestionIndex).toBe(0);
  expect(navigatedTo).toContain("/");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && bun test apps/client/src/stores/gameStore.test.ts
```

Expected: FAIL — `Cannot find module "./gameStore"`

- [ ] **Step 3: Implement gameStore**

```ts
// apps/client/src/stores/gameStore.ts
import { create } from "zustand";
import type { Question, RawQuestionData, FeedbackState, GameMode, GameState } from "../types";
import {
  MAX_COMBO,
  BLIND_MULTIPLIER,
  STEAL_GAIN,
  STEAL_LOSS,
  STEAL_FAIL_PENALTY,
  CHRONO_DURATION,
  CHRONO_TIMEOUT_PENALTY,
} from "../types";
import { checkAnswer, fuzzyMatch } from "../utils/fuzzyMatch";
import { sounds } from "../utils/sounds";
import { saveGameState, loadGameState, clearGameState } from "../utils/storage";
import { usePlayerStore } from "./playerStore";
import { usePackStore } from "./packStore";
import { getNavigate } from "./router";

function randomizeQuestion(qs: Question[], idx: number): Question[] {
  const remaining = qs.length - idx;
  if (remaining <= 0) return qs;
  const randomIdx = Math.floor(Math.random() * remaining) + idx;
  const copy = [...qs];
  [copy[idx], copy[randomIdx]] = [copy[randomIdx]!, copy[idx]!];
  return copy;
}

function formatCorrectAnswer(q: Question): string {
  return q.type === "vrai_faux" ? (q.answer ? "Vrai" : "Faux") : String(q.answer);
}

interface GameStoreState {
  questions: Question[];
  currentQuestionIndex: number;
  currentPlayerIndex: number;
  scores: Record<string, number>;
  combos: Record<string, number>;
  answered: boolean;
  blindMode: boolean;
  feedback: FeedbackState;
  showForceBtn: boolean;
  stealConfirmMode: boolean;
  pendingStealer: string | null;
  gameMode: GameMode;
  timeLeft: number;
  _timerRef: ReturnType<typeof setInterval> | null;

  // Derived (computed on read)
  currentQuestion: () => Question | null;
  currentPlayer: () => string;
  totalQuestions: () => number;
  isSolo: () => boolean;
  canSteal: () => boolean;

  // Actions
  startGame: (chunk: string, mode: GameMode) => Promise<void>;
  submitAnswer: (answer: string | boolean) => void;
  submitBlindAnswer: (input: string) => void;
  revealChoices: () => void;
  initiateSteal: (stealer: string) => void;
  confirmSteal: (valid: boolean) => void;
  forcePoint: () => void;
  nextQuestion: () => void;
  reset: () => void;
  restoreFromStorage: () => void;
  _startTimer: () => void;
  _stopTimer: () => void;
  _handleTimeout: () => void;
  _persist: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  questions: [],
  currentQuestionIndex: 0,
  currentPlayerIndex: 0,
  scores: {},
  combos: {},
  answered: false,
  blindMode: false,
  feedback: { visible: false, type: "neutral", text: "" },
  showForceBtn: false,
  stealConfirmMode: false,
  pendingStealer: null,
  gameMode: "classic",
  timeLeft: CHRONO_DURATION,
  _timerRef: null,

  // Derived
  currentQuestion: () => get().questions[get().currentQuestionIndex] ?? null,
  currentPlayer: () => usePlayerStore.getState().players[get().currentPlayerIndex] ?? "",
  totalQuestions: () => get().questions.length,
  isSolo: () => usePlayerStore.getState().players.length === 1,
  canSteal: () => get().gameMode === "voleur" && usePlayerStore.getState().players.length > 1,

  // Timer helpers
  _startTimer: () => {
    get()._stopTimer();
    set({ timeLeft: CHRONO_DURATION });
    const ref = setInterval(() => {
      const s = get();
      if (s.timeLeft <= 1) {
        set({ timeLeft: 0 });
        s._handleTimeout();
      } else {
        set({ timeLeft: s.timeLeft - 1 });
      }
    }, 1000);
    set({ _timerRef: ref });
  },

  _stopTimer: () => {
    const ref = get()._timerRef;
    if (ref) {
      clearInterval(ref);
      set({ _timerRef: null });
    }
  },

  _handleTimeout: () => {
    const s = get();
    if (s.answered) return;
    s._stopTimer();

    const player = s.currentPlayer();
    const q = s.currentQuestion();
    const newScores = { ...s.scores };
    newScores[player] = (newScores[player] ?? 0) - CHRONO_TIMEOUT_PENALTY;
    const newCombos = { ...s.combos };
    newCombos[player] = 0;
    sounds.fail();

    set({
      answered: true,
      scores: newScores,
      combos: newCombos,
      showForceBtn: false,
      feedback: {
        visible: true,
        type: "error",
        text: `Temps écoulé ! -0.5 pts. La bonne réponse était : ${q ? formatCorrectAnswer(q) : "?"}`,
      },
    });
  },

  _persist: () => {
    const s = get();
    const players = usePlayerStore.getState().players;
    const chunk = usePackStore.getState().selectedChunk;
    saveGameState({
      players,
      scores: s.scores,
      combos: s.combos,
      questions: s.questions,
      currentQuestionIndex: s.currentQuestionIndex,
      currentPlayerIndex: s.currentPlayerIndex,
      selectedChunk: chunk,
      gameMode: s.gameMode,
    });
  },

  startGame: async (chunk: string, mode: GameMode) => {
    const players = usePlayerStore.getState().players;
    const res = await fetch("/" + chunk);
    const data = (await res.json()) as RawQuestionData;
    const flat: Question[] = [];
    for (const [category, qs] of Object.entries(data)) {
      for (const q of qs) {
        flat.push({ ...q, category } as Question);
      }
    }

    const initScores: Record<string, number> = {};
    const initCombos: Record<string, number> = {};
    for (const p of players) {
      initScores[p] = 0;
      initCombos[p] = 0;
    }

    const randomized = randomizeQuestion(flat, 0);

    usePackStore.getState().selectChunk(chunk);

    set({
      questions: randomized,
      scores: initScores,
      combos: initCombos,
      currentQuestionIndex: 0,
      currentPlayerIndex: 0,
      gameMode: mode,
      answered: false,
      blindMode: randomized[0]?.type === "qcm",
      feedback: { visible: false, type: "neutral", text: "" },
      showForceBtn: false,
      stealConfirmMode: false,
      pendingStealer: null,
    });

    if (mode === "chrono") get()._startTimer();

    saveGameState({
      players,
      scores: initScores,
      combos: initCombos,
      questions: randomized,
      currentQuestionIndex: 0,
      currentPlayerIndex: 0,
      selectedChunk: chunk,
      gameMode: mode,
    });

    getNavigate()("/game");
  },

  submitAnswer: (answer: string | boolean) => {
    const s = get();
    if (s.answered) return;
    if (s.gameMode === "chrono") s._stopTimer();

    const q = s.currentQuestion()!;
    const player = s.currentPlayer();
    const correct = checkAnswer(answer, q);

    const newScores = { ...s.scores };
    const newCombos = { ...s.combos };

    if (correct) {
      newCombos[player] = Math.min((newCombos[player] ?? 0) + 1, MAX_COMBO);
      newScores[player] = (newScores[player] ?? 0) + newCombos[player]!;
      sounds.win();
      const combo = newCombos[player]!;
      const comboText = combo > 1 ? ` (x${combo} combo — +${combo} pts)` : "";
      set({
        answered: true,
        scores: newScores,
        combos: newCombos,
        stealConfirmMode: false,
        showForceBtn: false,
        feedback: { visible: true, type: "success", text: `Bonne réponse !${comboText}` },
      });
    } else {
      newCombos[player] = 0;
      sounds.fail();
      set({
        answered: true,
        scores: newScores,
        combos: newCombos,
        stealConfirmMode: false,
        showForceBtn: true,
        feedback: {
          visible: true,
          type: "error",
          text: `Mauvaise réponse ! La bonne réponse était : ${formatCorrectAnswer(q)}`,
        },
      });
    }
  },

  submitBlindAnswer: (input: string) => {
    const s = get();
    if (!input.trim() || s.answered) return;

    const q = s.currentQuestion()!;
    const correct = fuzzyMatch(input, String(q.answer));

    if (correct) {
      if (s.gameMode === "chrono") s._stopTimer();
      const player = s.currentPlayer();
      const newScores = { ...s.scores };
      const newCombos = { ...s.combos };
      newCombos[player] = Math.min((newCombos[player] ?? 0) + 1, MAX_COMBO);
      const multiplier = newCombos[player]!;
      const pts = BLIND_MULTIPLIER * multiplier;
      newScores[player] = (newScores[player] ?? 0) + pts;

      sounds.win();
      const comboText = multiplier > 1 ? ` (x${multiplier} combo)` : "";
      set({
        answered: true,
        blindMode: false,
        scores: newScores,
        combos: newCombos,
        showForceBtn: false,
        feedback: {
          visible: true,
          type: "warning",
          text: `Réponse en aveugle ! +${pts} pts${comboText}`,
        },
      });
    } else {
      set({ blindMode: false });
    }
  },

  revealChoices: () => {
    set({ blindMode: false });
  },

  initiateSteal: (stealer: string) => {
    const s = get();
    if (s.answered) return;
    const q = s.currentQuestion()!;

    set({
      pendingStealer: stealer,
      stealConfirmMode: true,
      feedback: {
        visible: true,
        type: "warning",
        text: "",
        html: `<span class="text-amber-400">${stealer}</span> tente de voler !<br><span class="text-sm text-amber-200 mt-1 block">Bonne réponse : <strong>${formatCorrectAnswer(q)}</strong></span>`,
      },
    });
  },

  confirmSteal: (valid: boolean) => {
    const s = get();
    const stealer = s.pendingStealer!;
    const activePlayer = s.currentPlayer();

    const newScores = { ...s.scores };
    const newCombos = { ...s.combos };

    if (valid) {
      newScores[stealer] = (newScores[stealer] ?? 0) + STEAL_GAIN;
      newCombos[stealer] = Math.min((newCombos[stealer] ?? 0) + 1, MAX_COMBO);
      newScores[activePlayer] = (newScores[activePlayer] ?? 0) - STEAL_LOSS;
      newCombos[activePlayer] = 0;
      sounds.steal();
      set({
        pendingStealer: null,
        answered: true,
        stealConfirmMode: false,
        scores: newScores,
        combos: newCombos,
        showForceBtn: false,
        feedback: {
          visible: true,
          type: "warning",
          text: `${stealer} a volé la réponse ! (+0.5 pts) — ${activePlayer} perd 0.5 pts`,
        },
      });
    } else {
      newScores[stealer] = (newScores[stealer] ?? 0) - STEAL_FAIL_PENALTY;
      newCombos[stealer] = 0;
      sounds.fail();
      set({
        pendingStealer: null,
        answered: true,
        stealConfirmMode: false,
        scores: newScores,
        combos: newCombos,
        showForceBtn: false,
        feedback: {
          visible: true,
          type: "error",
          text: `Vol raté ! ${stealer} perd 1 pt`,
        },
      });
    }
  },

  forcePoint: () => {
    const s = get();
    const player = s.currentPlayer();
    const newScores = { ...s.scores };
    const newCombos = { ...s.combos };
    newCombos[player] = Math.min((newCombos[player] ?? 0) + 1, MAX_COMBO);
    const multiplier = newCombos[player]!;
    newScores[player] = (newScores[player] ?? 0) + multiplier;
    const comboText = multiplier > 1 ? ` (x${multiplier} combo — +${multiplier} pts)` : "";
    set({
      scores: newScores,
      combos: newCombos,
      showForceBtn: false,
      feedback: { visible: true, type: "success", text: `Point accordé !${comboText}` },
    });
  },

  nextQuestion: () => {
    const s = get();
    const players = usePlayerStore.getState().players;
    const nextIdx = s.currentQuestionIndex + 1;
    const nextPlayerIdx = (s.currentPlayerIndex + 1) % players.length;

    if (nextIdx >= s.questions.length) {
      s._stopTimer();
      const chunk = usePackStore.getState().selectedChunk;
      if (chunk) usePackStore.getState().markFinished(chunk);
      clearGameState();
      getNavigate()("/end");
      return;
    }

    const randomized = randomizeQuestion(s.questions, nextIdx);

    set({
      questions: randomized,
      currentQuestionIndex: nextIdx,
      currentPlayerIndex: nextPlayerIdx,
      answered: false,
      blindMode: randomized[nextIdx]?.type === "qcm",
      feedback: { visible: false, type: "neutral", text: "" },
      showForceBtn: false,
      stealConfirmMode: false,
      pendingStealer: null,
    });

    if (s.gameMode === "chrono") get()._startTimer();

    get()._persist();
  },

  reset: () => {
    const s = get();
    s._stopTimer();
    usePlayerStore.getState().resetPlayers();
    usePackStore.getState().reset();
    clearGameState();

    set({
      questions: [],
      currentQuestionIndex: 0,
      currentPlayerIndex: 0,
      scores: {},
      combos: {},
      answered: false,
      blindMode: false,
      feedback: { visible: false, type: "neutral", text: "" },
      showForceBtn: false,
      stealConfirmMode: false,
      pendingStealer: null,
      gameMode: "classic",
      timeLeft: CHRONO_DURATION,
    });

    getNavigate()("/");
  },

  restoreFromStorage: () => {
    const saved = loadGameState();
    if (!saved || saved.questions.length === 0) return;

    // Restore players
    const playerStore = usePlayerStore.getState();
    playerStore.resetPlayers();
    for (const p of saved.players) {
      playerStore.addPlayer(p);
    }

    // Restore pack
    if (saved.selectedChunk) {
      usePackStore.getState().selectChunk(saved.selectedChunk);
    }

    set({
      questions: saved.questions,
      currentQuestionIndex: saved.currentQuestionIndex,
      currentPlayerIndex: saved.currentPlayerIndex,
      scores: saved.scores,
      combos: saved.combos || {},
      gameMode: saved.gameMode || "classic",
      blindMode: saved.questions[saved.currentQuestionIndex]?.type === "qcm",
      answered: false,
      feedback: { visible: false, type: "neutral", text: "" },
      showForceBtn: false,
      stealConfirmMode: false,
      pendingStealer: null,
    });

    if (saved.gameMode === "chrono") get()._startTimer();

    getNavigate()("/game");
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && bun test apps/client/src/stores/gameStore.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add apps/client/src/stores/gameStore.ts apps/client/src/stores/gameStore.test.ts
git commit -m "feat: add gameStore with tests"
```

---

### Task 6: Remove Screen type from types.ts

**Files:**
- Modify: `apps/client/src/types.ts`

- [ ] **Step 1: Remove the Screen type**

In `apps/client/src/types.ts`, delete this line:

```ts
export type Screen = "home" | "game" | "end";
```

- [ ] **Step 2: Verify no other files import Screen**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && grep -r "Screen" apps/client/src/ --include="*.ts" --include="*.tsx" | grep -v "HomeScreen\|GameScreen\|EndScreen\|node_modules"
```

Expected: Only the `types.ts` line (now removed) and `useGameState.ts` (will be deleted in Task 10). No other files import `Screen`.

- [ ] **Step 3: Commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add apps/client/src/types.ts
git commit -m "refactor: remove Screen type, replaced by router"
```

---

### Task 7: Rewrite App.tsx with BrowserRouter

**Files:**
- Modify: `apps/client/src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx**

Replace the entire content of `apps/client/src/App.tsx`:

```tsx
// apps/client/src/App.tsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { setNavigate } from "./stores/router";
import { useGameStore } from "./stores/gameStore";
import { HomeScreen } from "./components/HomeScreen";
import { GameScreen } from "./components/GameScreen";
import { EndScreen } from "./components/EndScreen";

function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
    setNavigate(navigate);
    useGameStore.getState().restoreFromStorage();
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/game" element={<GameScreen />} />
      <Route path="/end" element={<EndScreen />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add apps/client/src/App.tsx
git commit -m "refactor: rewrite App.tsx with BrowserRouter and routes"
```

---

### Task 8: Rewrite HomeScreen to use stores

**Files:**
- Modify: `apps/client/src/components/HomeScreen.tsx`

- [ ] **Step 1: Rewrite HomeScreen.tsx**

Replace the entire content of `apps/client/src/components/HomeScreen.tsx`:

```tsx
// apps/client/src/components/HomeScreen.tsx
import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react";
import type { PackMeta, GameMode } from "../types";
import { GAME_MODES } from "../types";
import { usePlayerStore } from "../stores/playerStore";
import { usePackStore } from "../stores/packStore";
import { useGameStore } from "../stores/gameStore";

export function HomeScreen() {
  const players = usePlayerStore((s) => s.players);
  const addPlayer = usePlayerStore((s) => s.addPlayer);
  const removePlayer = usePlayerStore((s) => s.removePlayer);
  const selectedChunk = usePackStore((s) => s.selectedChunk);
  const selectChunk = usePackStore((s) => s.selectChunk);
  const finishedChunks = usePackStore((s) => s.finishedChunks);
  const startGame = useGameStore((s) => s.startGame);

  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");
  const [packs, setPacks] = useState<PackMeta[]>([]);
  const [step, setStep] = useState<"pack" | "mode" | "players">("pack");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(6);
  const gridRef = useRef<HTMLDivElement>(null);

  const computePerPage = useCallback(() => {
    const vh = window.innerHeight;
    const headerHeight = 200;
    const paginationHeight = 60;
    const available = vh - headerHeight - paginationHeight;
    const cardHeight = 160;
    const gap = 16;
    const w = window.innerWidth;
    const cols = w >= 1024 ? 3 : w >= 640 ? 2 : 1;
    const rows = Math.max(1, Math.floor(available / (cardHeight + gap)));
    return cols * rows;
  }, []);

  useEffect(() => {
    const update = () => setPerPage(computePerPage());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [computePerPage]);

  useEffect(() => {
    fetch("/packs.json")
      .then((r) => r.json())
      .then((data: PackMeta[]) => {
        setPacks(data);
        if (!selectedChunk) {
          const firstUnfinished = data.find((p) => !finishedChunks.includes(p.file));
          selectChunk(firstUnfinished?.file || data[0]?.file || "");
        }
      });
  }, []);

  const handleAdd = () => {
    if (addPlayer(inputValue)) setInputValue("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  const selectedPack = packs.find((p) => p.file === selectedChunk);
  const canStart = players.length >= 1 && selectedChunk;

  // Step 1: Pack selection
  if (step === "pack") {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-center mb-2 text-indigo-400">Quiz</h1>
          <p className="text-center text-gray-400 mb-6 sm:mb-8">Choisis ton pack de questions</p>

          <div className="mb-5 sm:mb-6">
            <input
              type="text"
              placeholder="Rechercher un pack..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-5 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base"
            />
          </div>

          {(() => {
            const filtered = packs.filter((p) => {
              if (!search.trim()) return true;
              const q = search.toLowerCase();
              return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
            });
            const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
            const safePage = Math.min(page, totalPages - 1);
            const pageItems = filtered.slice(safePage * perPage, (safePage + 1) * perPage);

            return (
              <>
                <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {pageItems.map((pack) => {
                    const done = finishedChunks.includes(pack.file);
                    const active = pack.file === selectedChunk;
                    return (
                      <button
                        key={pack.file}
                        onClick={() => {
                          selectChunk(pack.file);
                          setStep("players");
                        }}
                        className={`relative text-left rounded-xl overflow-hidden transition-all duration-200 ${
                          active
                            ? "ring-2 ring-indigo-400 scale-[1.02]"
                            : "ring-1 ring-gray-800 hover:ring-gray-600 hover:scale-[1.01]"
                        }`}
                      >
                        <div className={`bg-gradient-to-br ${pack.gradient} px-4 sm:px-5 py-5 sm:py-6 flex items-center gap-3 sm:gap-4`}>
                          <span className="text-3xl sm:text-4xl">{pack.icon}</span>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-white text-base sm:text-lg leading-tight truncate">{pack.name}</h3>
                            {done && (
                              <span className="inline-block mt-1 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                                Terminé
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="bg-gray-900 px-4 sm:px-5 py-3 sm:py-4">
                          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{pack.description}</p>
                          {pack.questionCount != null && (
                            <p className="text-xs text-gray-500 mt-2">{pack.questionCount} questions</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      className="px-3 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                          i === safePage
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage === totalPages - 1}
                      className="px-3 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  // Step 2: Players
  if (step === "players") {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-md">
          <button
            onClick={() => setStep("pack")}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Changer de mode
          </button>

          {selectedPack && (
            <div className={`bg-gradient-to-br ${selectedPack.gradient} rounded-xl px-5 py-4 flex items-center gap-4 mb-8`}>
              <span className="text-3xl">{selectedPack.icon}</span>
              <div>
                <h2 className="font-bold text-white text-lg">{selectedPack.name}</h2>
                <p className="text-white/70 text-sm">{selectedPack.description}</p>
              </div>
            </div>
          )}

          <div className="bg-gray-900 rounded-2xl shadow-2xl p-6 sm:p-8 mb-6">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Qui joue ?</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Nom du joueur"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                maxLength={20}
                autoFocus
              />
              <button
                onClick={handleAdd}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                Ajouter
              </button>
            </div>

            {players.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <div key={p} className="flex items-center gap-2 bg-gray-800 rounded-full px-4 py-1.5">
                    <span className="font-medium text-sm">{p}</span>
                    <button
                      onClick={() => removePlayer(p)}
                      className="text-gray-500 hover:text-red-400 text-lg leading-none"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {players.length === 0 && (
              <p className="text-sm text-gray-500">Ajoute au moins un joueur pour commencer</p>
            )}
          </div>

          <button
            onClick={() => setStep("mode")}
            disabled={players.length < 1}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl text-lg transition-colors shadow-lg"
          >
            Choisir le mode de jeu
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Game mode selection
  const availableModes = GAME_MODES.filter((m) => {
    if (m.id === "voleur" && players.length < 2) return false;
    return true;
  });

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-lg">
        <button
          onClick={() => setStep("players")}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Retour aux joueurs
        </button>

        {selectedPack && (
          <div className={`bg-gradient-to-br ${selectedPack.gradient} rounded-xl px-5 py-4 flex items-center gap-4 mb-4`}>
            <span className="text-3xl">{selectedPack.icon}</span>
            <div>
              <h2 className="font-bold text-white text-lg">{selectedPack.name}</h2>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-400 mb-6">
          {players.length} joueur{players.length > 1 ? "s" : ""} : {players.join(", ")}
        </p>

        <h2 className="text-lg font-semibold text-gray-200 mb-4">Choisis un mode de jeu</h2>
        <div className="space-y-3 mb-8">
          {availableModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                if (selectedChunk) startGame(selectedChunk, mode.id);
              }}
              className="w-full text-left rounded-xl overflow-hidden ring-1 ring-gray-800 hover:ring-gray-600 hover:scale-[1.01] transition-all duration-200"
            >
              <div className={`bg-gradient-to-br ${mode.gradient} px-5 py-4 flex items-center gap-4`}>
                <span className="text-3xl">{mode.icon}</span>
                <div>
                  <h3 className="font-bold text-white text-lg">{mode.name}</h3>
                  <p className="text-white/70 text-sm">{mode.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add apps/client/src/components/HomeScreen.tsx
git commit -m "refactor: HomeScreen uses stores instead of props"
```

---

### Task 9: Rewrite GameScreen to use stores

**Files:**
- Modify: `apps/client/src/components/GameScreen.tsx`

- [ ] **Step 1: Rewrite GameScreen.tsx**

Replace the entire content of `apps/client/src/components/GameScreen.tsx`:

```tsx
// apps/client/src/components/GameScreen.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CHRONO_DURATION } from "../types";
import { useGameStore } from "../stores/gameStore";
import { usePlayerStore } from "../stores/playerStore";
import { BlindInput, QcmChoices, VraiFaux, TextInput } from "./AnswerInputs";
import { Feedback } from "./Feedback";
import { StealZone } from "./StealZone";
import { ScoreBoard, SoloScore } from "./ScoreBoard";

export function GameScreen() {
  const navigate = useNavigate();

  const questions = useGameStore((s) => s.questions);
  const currentQuestionIndex = useGameStore((s) => s.currentQuestionIndex);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const scores = useGameStore((s) => s.scores);
  const combos = useGameStore((s) => s.combos);
  const answered = useGameStore((s) => s.answered);
  const blindMode = useGameStore((s) => s.blindMode);
  const feedback = useGameStore((s) => s.feedback);
  const showForceBtn = useGameStore((s) => s.showForceBtn);
  const stealConfirmMode = useGameStore((s) => s.stealConfirmMode);
  const gameMode = useGameStore((s) => s.gameMode);
  const timeLeft = useGameStore((s) => s.timeLeft);
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const submitBlindAnswer = useGameStore((s) => s.submitBlindAnswer);
  const revealChoices = useGameStore((s) => s.revealChoices);
  const initiateSteal = useGameStore((s) => s.initiateSteal);
  const confirmSteal = useGameStore((s) => s.confirmSteal);
  const forcePoint = useGameStore((s) => s.forcePoint);
  const nextQuestion = useGameStore((s) => s.nextQuestion);
  const reset = useGameStore((s) => s.reset);

  const players = usePlayerStore((s) => s.players);

  const currentQuestion = useGameStore((s) => s.currentQuestion)();
  const currentPlayer = useGameStore((s) => s.currentPlayer)();
  const isSolo = useGameStore((s) => s.isSolo)();
  const canSteal = useGameStore((s) => s.canSteal)();
  const totalQuestions = useGameStore((s) => s.totalQuestions)();

  // Guard: redirect to home if no active game
  useEffect(() => {
    if (questions.length === 0) {
      navigate("/", { replace: true });
    }
  }, [questions.length, navigate]);

  if (!currentQuestion) return null;

  return (
    <>
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-10 w-full max-w-2xl mx-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950 px-3 py-1 rounded-full">
                {currentQuestion.category}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {gameMode === "chrono" && !answered && (
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  timeLeft <= 5 ? "bg-red-950 text-red-400 animate-pulse" : "bg-gray-800 text-gray-300"
                }`}>
                  {timeLeft}s
                </span>
              )}
              {isSolo && (
                <SoloScore score={scores[players[0]!] ?? 0} combo={combos[players[0]!] ?? 0} />
              )}
              <span className="text-sm text-gray-400">
                Question {currentQuestionIndex + 1} / {totalQuestions}
              </span>
            </div>
          </div>

          {/* Timer bar */}
          {gameMode === "chrono" && !answered && (
            <div className="w-full bg-gray-800 rounded-full h-1.5 mb-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                  timeLeft <= 5 ? "bg-red-500" : "bg-indigo-500"
                }`}
                style={{ width: `${(timeLeft / CHRONO_DURATION) * 100}%` }}
              />
            </div>
          )}

          {/* Player turn */}
          {!isSolo && (
            <div className="mb-2">
              <p className="text-sm text-gray-400">C'est au tour de</p>
              <p className="text-2xl font-bold text-emerald-400">{currentPlayer}</p>
            </div>
          )}

          {/* Question */}
          <p className="text-xl font-semibold my-6 leading-relaxed">{currentQuestion.question}</p>

          {/* Answer inputs */}
          {currentQuestion.type === "qcm" && blindMode && !answered && (
            <BlindInput onSubmit={submitBlindAnswer} onReveal={revealChoices} />
          )}

          {currentQuestion.type === "qcm" && !blindMode && (
            <QcmChoices
              choices={currentQuestion.choices || []}
              disabled={answered}
              onSelect={(c) => submitAnswer(c)}
            />
          )}

          {currentQuestion.type === "vrai_faux" && (
            <VraiFaux disabled={answered} onSelect={(v) => submitAnswer(v)} />
          )}

          {currentQuestion.type === "texte" && (
            <TextInput disabled={answered} onSubmit={(v) => submitAnswer(v)} />
          )}

          {/* Feedback */}
          <Feedback feedback={feedback} />

          {/* Steal zone */}
          {canSteal && !stealConfirmMode && (
            <StealZone
              players={players}
              currentPlayerIndex={currentPlayerIndex}
              isSolo={false}
              answered={answered}
              onSteal={initiateSteal}
            />
          )}

          {/* Action buttons */}
          {(answered || stealConfirmMode) && (
            <div className="mt-6 flex gap-3">
              {stealConfirmMode ? (
                <>
                  <button
                    onClick={() => confirmSteal(true)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-lg transition-colors"
                  >
                    Valider le vol
                  </button>
                  <button
                    onClick={() => confirmSteal(false)}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-lg transition-colors"
                  >
                    Refuser
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={nextQuestion}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-lg transition-colors"
                  >
                    Question suivante
                  </button>
                  {showForceBtn && gameMode !== "chrono" && (
                    <button
                      onClick={forcePoint}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-5 rounded-xl text-lg transition-colors"
                    >
                      Compter le point
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Scores */}
          <ScoreBoard
            players={players}
            scores={scores}
            combos={combos}
            currentPlayerIndex={currentPlayerIndex}
            isSolo={isSolo}
          />
        </div>
      </div>

      {/* Floating reset button */}
      <button
        onClick={reset}
        className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-500 text-white p-3 rounded-full shadow-lg transition-colors"
        title="Recommencer la partie"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.36-5.36M20 15a9 9 0 01-15.36 5.36" />
        </svg>
      </button>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add apps/client/src/components/GameScreen.tsx
git commit -m "refactor: GameScreen uses stores instead of props"
```

---

### Task 10: Rewrite EndScreen to use stores

**Files:**
- Modify: `apps/client/src/components/EndScreen.tsx`

- [ ] **Step 1: Rewrite EndScreen.tsx**

Replace the entire content of `apps/client/src/components/EndScreen.tsx`:

```tsx
// apps/client/src/components/EndScreen.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../stores/gameStore";
import { usePlayerStore } from "../stores/playerStore";

const MEDALS = ["text-yellow-400", "text-gray-300", "text-amber-600"];

export function EndScreen() {
  const navigate = useNavigate();

  const scores = useGameStore((s) => s.scores);
  const reset = useGameStore((s) => s.reset);
  const totalQuestions = useGameStore((s) => s.totalQuestions)();

  const players = usePlayerStore((s) => s.players);
  const isSolo = players.length === 1;

  // Guard: redirect to home if no scores
  useEffect(() => {
    if (Object.keys(scores).length === 0) {
      navigate("/", { replace: true });
    }
  }, [scores, navigate]);

  if (Object.keys(scores).length === 0) return null;

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-gray-900 rounded-2xl shadow-2xl p-10 w-full max-w-lg mx-4 text-center">
        <h2 className="text-4xl font-bold mb-2 text-indigo-400">Partie terminée !</h2>
        <p className="text-gray-400 mb-8">{isSolo ? "Ton score final" : "Voici le classement final"}</p>

        {isSolo ? (
          <div className="bg-indigo-950 border border-indigo-700 rounded-xl px-5 py-6 mb-8">
            <span className="text-5xl font-bold text-indigo-400">{scores[players[0]!]}</span>
            <span className="text-xl text-gray-400 ml-2">pts</span>
            <p className="text-gray-400 mt-2 text-sm">sur {totalQuestions} questions</p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {[...players]
              .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
              .map((p, i) => {
                const medal = i < 3 ? MEDALS[i] : "text-gray-400";
                const bg = i === 0 ? "bg-yellow-950 border-yellow-700" : "bg-gray-800 border-gray-700";
                return (
                  <div key={p} className={`flex items-center justify-between ${bg} border rounded-xl px-5 py-4`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-bold ${medal}`}>#{i + 1}</span>
                      <span className="font-semibold text-lg">{p}</span>
                    </div>
                    <span className={`text-2xl font-bold ${medal}`}>{scores[p]} pts</span>
                  </div>
                );
              })}
          </div>
        )}

        <button
          onClick={reset}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-lg transition-colors"
        >
          Nouvelle partie
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add apps/client/src/components/EndScreen.tsx
git commit -m "refactor: EndScreen uses stores instead of props"
```

---

### Task 11: Delete useGameState hook

**Files:**
- Delete: `apps/client/src/hooks/useGameState.ts`

- [ ] **Step 1: Delete the file**

```bash
rm /Users/arthur/Documents/Dev/projects/quiz-app/apps/client/src/hooks/useGameState.ts
```

- [ ] **Step 2: Verify no remaining imports**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && grep -r "useGameState" apps/client/src/ --include="*.ts" --include="*.tsx"
```

Expected: No results.

- [ ] **Step 3: Remove empty hooks directory**

```bash
rmdir /Users/arthur/Documents/Dev/projects/quiz-app/apps/client/src/hooks
```

- [ ] **Step 4: Commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add -A apps/client/src/hooks/
git commit -m "refactor: delete useGameState hook, replaced by zustand stores"
```

---

### Task 12: Build, run all tests, and verify manually

**Files:** None (verification only)

- [ ] **Step 1: Run all store tests**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && bun test apps/client/src/stores/
```

Expected: All tests pass (playerStore: 6, packStore: 4, gameStore: 7).

- [ ] **Step 2: Build the project**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && bun run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Start dev server and verify manually**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app && bun run dev
```

Open `http://localhost:3000` in browser. Verify:
1. Home screen loads, packs display
2. Select a pack, add players, choose game mode -> navigates to `/game`
3. Answer questions, scores update, combos work
4. After all questions -> navigates to `/end`, leaderboard shows
5. "Nouvelle partie" -> back to `/`
6. Browser back/forward buttons work
7. Refresh during game -> game restores from localStorage

- [ ] **Step 4: Final commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add -A
git commit -m "refactor: complete zustand + react-router migration"
```
