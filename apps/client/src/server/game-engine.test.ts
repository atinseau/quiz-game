import { afterEach, describe, expect, test } from "bun:test";
import { STEAL_FAIL_PENALTY, STEAL_GAIN, STEAL_LOSS } from "../types";
import { submitAnswer } from "./game-engine";
import type { GameState, QuestionFull, Room, RoomPlayer } from "./types";

function makePlayer(id: string): RoomPlayer {
  return {
    clerkId: id,
    username: id,
    gender: "homme",
    ws: null,
    connected: true,
    disconnectedAt: null,
    graceTimer: null,
  };
}

function makeQuestion(): QuestionFull {
  return {
    type: "qcm",
    text: "Quelle est la capitale de la France ?",
    choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
    answer: "Paris",
    category: "Culture",
  };
}

function makeVoleurRoom(): Room {
  const game: GameState = {
    questions: [makeQuestion()],
    currentQuestionIndex: 0,
    currentPlayerIndex: 0,
    scores: { main: 0, stealer: 0 },
    combos: { main: 0, stealer: 0 },
    answers: new Map(),
    questionStartedAt: Date.now(),
    resolved: false,
    alcoholState: null,
  };
  return {
    code: "TEST",
    hostClerkId: "main",
    players: new Map([
      ["main", makePlayer("main")],
      ["stealer", makePlayer("stealer")],
    ]),
    status: "playing",
    packSlug: "pack-test",
    mode: "voleur",
    game,
    alcoholConfig: null,
    endedAt: null,
    nextQuestionTimer: null,
  };
}

const rooms: Room[] = [];
afterEach(() => {
  // Avoid leaking scheduled next-question timers from resolved turns.
  for (const r of rooms) {
    if (r.nextQuestionTimer) {
      clearTimeout(r.nextQuestionTimer);
      r.nextQuestionTimer = null;
    }
  }
  rooms.length = 0;
});

describe("resolveVoleur — stealer correct FIRST", () => {
  test("stealer answering correctly before main resolves the turn immediately as a successful steal", () => {
    const room = makeVoleurRoom();
    rooms.push(room);

    submitAnswer(room, "stealer", "Paris");

    expect(room.game?.resolved).toBe(true);
    expect(room.game?.scores.stealer).toBe(STEAL_GAIN);
    expect(room.game?.scores.main).toBe(-STEAL_LOSS);
  });

  test("main attempting to answer after a successful instant steal is ignored", () => {
    const room = makeVoleurRoom();
    rooms.push(room);

    submitAnswer(room, "stealer", "Paris");
    submitAnswer(room, "main", "Paris");

    expect(room.game?.scores.stealer).toBe(STEAL_GAIN);
    expect(room.game?.scores.main).toBe(-STEAL_LOSS);
  });
});

describe("resolveVoleur — main wrong ends the turn immediately", () => {
  test("stealer who hasn't answered cannot steal anymore once main answers wrong", () => {
    const room = makeVoleurRoom();
    rooms.push(room);

    submitAnswer(room, "main", "Lyon"); // main wrong, stealer hasn't said a word

    expect(room.game?.resolved).toBe(true);
    // No scoring at all — main wrong is a clean end, stealer didn't risk anything
    expect(room.game?.scores.main).toBe(0);
    expect(room.game?.scores.stealer).toBe(0);

    // Stealer tries to sneak in after main closed the turn — no-op
    submitAnswer(room, "stealer", "Paris");
    expect(room.game?.scores.stealer).toBe(0);
  });

  test("stealer who already answered wrong pays the steal penalty when main wraps up", () => {
    const room = makeVoleurRoom();
    rooms.push(room);

    submitAnswer(room, "stealer", "Lyon"); // wrong, waits for main
    expect(room.game?.resolved).toBe(false); // still waiting on main

    submitAnswer(room, "main", "Lyon"); // main wrong → turn ends

    expect(room.game?.resolved).toBe(true);
    expect(room.game?.scores.stealer).toBe(-STEAL_FAIL_PENALTY);
    expect(room.game?.scores.main).toBe(0);
  });

  test("main correct penalizes stealers who already answered wrong", () => {
    const room = makeVoleurRoom();
    rooms.push(room);

    submitAnswer(room, "stealer", "Lyon"); // wrong guess, locks them out
    submitAnswer(room, "main", "Paris"); // main wins

    expect(room.game?.scores.main).toBe(1);
    expect(room.game?.scores.stealer).toBe(-STEAL_FAIL_PENALTY);
  });
});
