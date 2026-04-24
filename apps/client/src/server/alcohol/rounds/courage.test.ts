// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md → BUG-courage-splice
//
// Reproduce the mutation of game.questions in pickCourageQuestion:
//   game.questions.splice(i, 1)
// The round steals a QCM question from the remaining pool, which:
//   1. Shortens game.questions.length (possibly ending the game prematurely).
//   2. Shifts indices, breaking currentQuestionIndex-based iteration.
// Expected behaviour: pickCourageQuestion should not mutate the pool.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Room, RoomPlayer } from "../../types";
import type { AlcoholState } from "../types";

// Break the framework ↔ rounds circular import — see cupidon.test.ts.
await import("../framework");
const { courageRound } = await import("./courage");

const originalSetTimeout = globalThis.setTimeout;
const originalRandom = Math.random;
beforeAll(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  globalThis.setTimeout = ((_fn: () => void, _ms?: number) => 0) as any;
});
afterAll(() => {
  globalThis.setTimeout = originalSetTimeout;
  Math.random = originalRandom;
});

const captured: Record<string, unknown>[] = [];

function fakeWs() {
  return {
    send: (payload: string) => {
      try {
        captured.push(JSON.parse(payload));
      } catch {
        // ignore non-JSON
      }
    },
    readyState: 1,
    // biome-ignore lint/suspicious/noExplicitAny: test stub
  } as any;
}

function makePlayer(clerkId: string, username: string): RoomPlayer {
  return {
    clerkId,
    username,
    gender: "homme",
    ws: fakeWs(),
    connected: true,
    disconnectedAt: null,
    graceTimer: null,
  };
}

function makeRoom(playerSpecs: { clerkId: string; username: string }[]): Room {
  const map = new Map<string, RoomPlayer>();
  for (const p of playerSpecs)
    map.set(p.clerkId, makePlayer(p.clerkId, p.username));
  const scores: Record<string, number> = {};
  const combos: Record<string, number> = {};
  for (const p of playerSpecs) {
    scores[p.clerkId] = 0;
    combos[p.clerkId] = 0;
  }
  const alcoholState: AlcoholState = {
    config: {
      enabled: true,
      frequency: 3,
      enabledRounds: [],
      culSecEndGame: false,
    },
    turnsSinceLastSpecial: 0,
    specialRoundQueue: [],
    activeRound: null,
    cupidLinks: [],
    usedByCourage: new Set(),
  };
  return {
    code: "TEST",
    hostClerkId: playerSpecs[0]?.clerkId ?? "",
    players: map,
    status: "playing",
    mode: "classic",
    packSlug: "test",
    game: {
      questions: [],
      currentQuestionIndex: 0,
      currentPlayerIndex: 0,
      scores,
      combos,
      answers: new Map(),
      questionStartedAt: 0,
      resolved: false,
      alcoholState,
    },
    alcoholConfig: null,
    endedAt: null,
    nextQuestionTimer: null,
  } as unknown as Room;
}

describe("BUG-courage-splice — pickCourageQuestion mutates game.questions.length", () => {
  test("courage accept does not reduce game.questions.length", () => {
    const room = makeRoom([
      { clerkId: "p1", username: "A" },
      { clerkId: "p2", username: "B" },
    ]);
    // biome-ignore lint/style/noNonNullAssertion: test setup guarantees
    const game = room.game!;
    game.questions = [
      {
        type: "qcm",
        text: "Q1",
        choices: ["a", "b"],
        answer: "a",
        category: "x",
      },
      {
        type: "qcm",
        text: "Q2",
        choices: ["a", "b"],
        answer: "a",
        category: "x",
      },
      {
        type: "qcm",
        text: "Q3",
        choices: ["a", "b"],
        answer: "a",
        category: "x",
      },
      {
        type: "texte",
        text: "Q4",
        choices: undefined,
        answer: "abc",
        category: "x",
      },
    ];
    game.currentQuestionIndex = 0;

    // biome-ignore lint/style/noNonNullAssertion: test setup guarantees
    const state = game.alcoholState!;
    const lengthBefore = game.questions.length;

    // Force getRandomConnectedPlayer to pick index 0 → p1, so we know which
    // clerkId to use when simulating acceptance.
    Math.random = () => 0;
    courageRound.start(room, state);
    Math.random = originalRandom;

    // Simulate acceptance — triggers pickCourageQuestion which splices.
    courageRound.handleMessage(room, state, "p1", {
      type: "courage_choice",
      accept: true,
    });

    expect(game.questions.length).toBe(lengthBefore);
    // Today (buggy): lengthBefore - 1 (one QCM spliced out of the pool).
  });
});

describe("courage_result broadcast — shows answer + correctAnswer to everyone", () => {
  function setupAndAccept(targetAnswer: string) {
    captured.length = 0;
    const room = makeRoom([
      { clerkId: "p1", username: "Alice" },
      { clerkId: "p2", username: "Bob" },
    ]);
    // biome-ignore lint/style/noNonNullAssertion: test setup
    const game = room.game!;
    // pickCourageQuestion scans from currentQuestionIndex + 1 onwards for a
    // QCM. Put the current (unused) question at 0 and the target at 1.
    game.questions = [
      {
        type: "qcm",
        text: "placeholder",
        choices: ["a", "b"],
        answer: "a",
        category: "x",
      },
      {
        type: "qcm",
        text: "Capitale de l'Espagne ?",
        choices: ["Madrid", "Barcelone"],
        answer: "Madrid",
        category: "geo",
      },
    ];
    game.currentQuestionIndex = 0;
    // biome-ignore lint/style/noNonNullAssertion: test setup
    const state = game.alcoholState!;

    // Pin the random pick to p1 (Alice).
    Math.random = () => 0;
    courageRound.start(room, state);
    Math.random = originalRandom;

    // Clear captures from the start phase — we only care about the answer
    // phase broadcasts.
    courageRound.handleMessage(room, state, "p1", {
      type: "courage_choice",
      accept: true,
    });
    captured.length = 0;

    courageRound.handleMessage(room, state, "p1", {
      type: "courage_answer",
      answer: targetAnswer,
    });

    const result = captured.find((m) => m.type === "courage_result") as
      | {
          correct: boolean;
          pointsDelta: number;
          givenAnswer?: string | boolean;
          correctAnswer?: string | boolean;
        }
      | undefined;
    return { result, captured: [...captured] };
  }

  test("wrong answer — broadcast includes the player's answer and the truth", () => {
    const { result } = setupAndAccept("Barcelone");
    expect(result).toBeDefined();
    expect(result?.correct).toBe(false);
    expect(result?.givenAnswer).toBe("Barcelone");
    expect(result?.correctAnswer).toBe("Madrid");
  });

  test("correct answer — broadcast still carries both fields", () => {
    const { result } = setupAndAccept("Madrid");
    expect(result).toBeDefined();
    expect(result?.correct).toBe(true);
    expect(result?.givenAnswer).toBe("Madrid");
    expect(result?.correctAnswer).toBe("Madrid");
  });
});
