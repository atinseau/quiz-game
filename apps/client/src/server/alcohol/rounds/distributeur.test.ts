// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md → BUG-distributeur-rotation
//
// Reproduce the insertion-order selection in distributeur.start:
//   Object.entries(game.scores).find(([_, s]) => s === maxScore)?.[0]
// When several players are tied at the max, Object.entries() iterates in
// insertion order, so the player added first always wins. The spec
// (alcohol-mode-design.md:129) calls for rotation-order selection: the tie
// should be broken starting from the current player (rotation next).

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Room, RoomPlayer } from "../../types";
import type { AlcoholState } from "../types";

// Break the framework ↔ rounds circular import — see cupidon.test.ts.
await import("../framework");
const { distributeurRound } = await import("./distributeur");

const originalSetTimeout = globalThis.setTimeout;
beforeAll(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  globalThis.setTimeout = ((_fn: () => void, _ms?: number) => 0) as any;
});
afterAll(() => {
  globalThis.setTimeout = originalSetTimeout;
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

describe("BUG-distributeur-rotation — selection uses insertion order, not rotation order", () => {
  test("distributeur selects winner by rotation order when scores are tied", () => {
    // Setup: 3 players, scores [10, 10, 0]. Max is tied between p1 and p2.
    // currentPlayerIndex = 1 (p2 is the current player).
    // Object.entries(scores) iterates in insertion order → p1 is picked.
    // Rotation-aware selection should prefer p2 (the current player),
    // or at minimum not systematically bias toward the first-inserted tied player.
    captured.length = 0;
    const room = makeRoom([
      { clerkId: "p1", username: "A" },
      { clerkId: "p2", username: "B" },
      { clerkId: "p3", username: "C" },
    ]);
    // biome-ignore lint/style/noNonNullAssertion: test setup guarantees
    const game = room.game!;
    game.scores = { p1: 10, p2: 10, p3: 0 };
    game.currentPlayerIndex = 1; // p2 is the current player
    // biome-ignore lint/style/noNonNullAssertion: test setup guarantees
    const state = game.alcoholState!;

    distributeurRound.start(room, state);

    const startMsg = captured.find((m) => m.type === "special_round_start");
    expect(startMsg).toBeDefined();
    if (!startMsg) return;
    const data = startMsg.data as { distributorClerkId: string };

    // Expected (rotation-aware): p2 (the current player, tied at max).
    // Today (buggy): p1 (first in insertion order).
    expect(data.distributorClerkId).toBe("p2");
  });
});
