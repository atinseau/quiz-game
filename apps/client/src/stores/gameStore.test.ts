import { beforeEach, describe, expect, mock, test } from "bun:test";

// Mock localStorage
const storage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = value;
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    for (const k in storage) delete storage[k];
  },
  length: 0,
  key: () => null,
};

// Mock sounds module
mock.module("../utils/sounds", () => ({
  sounds: { win: () => {}, fail: () => {}, steal: () => {} },
}));

// Mock navigate
const navigatedPaths: string[] = [];

import { setNavigate } from "./router";

setNavigate(((path: string) => {
  navigatedPaths.push(path);
}) as any);

// Mock fetch
const mockQuestions = {
  Histoire: [
    {
      type: "qcm",
      question: "Q1?",
      choices: ["A", "B", "C", "D"],
      answer: "A",
    },
    { type: "texte", question: "Q2?", answer: "Paris" },
  ],
};
globalThis.fetch = mock(() =>
  Promise.resolve(new Response(JSON.stringify(mockQuestions))),
) as any;

import { useGameStore } from "./gameStore";
import { usePackStore } from "./packStore";
import { usePlayerStore } from "./playerStore";

describe("gameStore", () => {
  beforeEach(() => {
    localStorage.clear();
    navigatedPaths.length = 0;

    usePlayerStore.setState({ players: [] });
    usePackStore.setState({ selectedChunk: null, finishedChunks: [] });
    useGameStore.getState().reset();
    // Clear navigated paths again after reset (which navigates to /)
    navigatedPaths.length = 0;

    // Add players
    usePlayerStore.getState().addPlayer("Alice");
    usePlayerStore.getState().addPlayer("Bob");
  });

  test("startGame loads questions, inits scores, navigates to /game", async () => {
    await useGameStore.getState().startGame("histoire.json", "classic");

    const state = useGameStore.getState();
    expect(state.questions.length).toBe(2);
    expect(state.scores).toEqual({ Alice: 0, Bob: 0 });
    expect(state.combos).toEqual({ Alice: 0, Bob: 0 });
    expect(state.currentQuestionIndex).toBe(0);
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.gameMode).toBe("classic");
    expect(navigatedPaths).toContain("/game");
  });

  test("submitAnswer correct increments score and combo", async () => {
    await useGameStore.getState().startGame("histoire.json", "classic");

    // Find the current question and give the correct answer
    const q = useGameStore.getState().currentQuestion();
    const correctAnswer = q?.answer;
    useGameStore.getState().submitAnswer(correctAnswer!);

    const state = useGameStore.getState();
    const player = usePlayerStore.getState().players[0]!;
    expect(state.scores[player]).toBeGreaterThan(0);
    expect(state.combos[player]).toBe(1);
  });

  test("submitAnswer incorrect sets combo to 0", async () => {
    await useGameStore.getState().startGame("histoire.json", "classic");

    // First give correct answer to build combo
    const q1 = useGameStore.getState().currentQuestion();
    useGameStore.getState().submitAnswer(q1!.answer);

    // Move to next question
    useGameStore.getState().nextQuestion();

    // Now give wrong answer
    useGameStore.getState().submitAnswer("WRONG_ANSWER_XYZ");

    const state = useGameStore.getState();
    const player = usePlayerStore.getState().players[state.currentPlayerIndex]!;
    expect(state.combos[player]).toBe(0);
  });

  test("nextQuestion advances index and player", async () => {
    await useGameStore.getState().startGame("histoire.json", "classic");
    useGameStore.getState().submitAnswer("anything");
    useGameStore.getState().nextQuestion();

    const state = useGameStore.getState();
    expect(state.currentQuestionIndex).toBe(1);
    expect(state.currentPlayerIndex).toBe(1);
  });

  test("nextQuestion navigates to /end when questions exhausted", async () => {
    await useGameStore.getState().startGame("histoire.json", "classic");
    navigatedPaths.length = 0;

    // Answer and advance through all questions
    useGameStore.getState().submitAnswer("anything");
    useGameStore.getState().nextQuestion();
    useGameStore.getState().submitAnswer("anything");
    useGameStore.getState().nextQuestion();

    expect(navigatedPaths).toContain("/end");
  });

  test("forcePoint awards points with combo", async () => {
    await useGameStore.getState().startGame("histoire.json", "classic");

    const player = usePlayerStore.getState().players[0]!;
    useGameStore.getState().forcePoint();

    const state = useGameStore.getState();
    expect(state.scores[player]).toBeGreaterThan(0);
    expect(state.combos[player]).toBe(1);
  });

  test("reset clears all game state and navigates to /", async () => {
    await useGameStore.getState().startGame("histoire.json", "classic");
    navigatedPaths.length = 0;

    useGameStore.getState().reset();

    const state = useGameStore.getState();
    expect(state.questions).toEqual([]);
    expect(state.currentQuestionIndex).toBe(0);
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.scores).toEqual({});
    expect(state.combos).toEqual({});
    expect(state.gameMode).toBe("classic");
    expect(navigatedPaths).toContain("/");
  });
});
