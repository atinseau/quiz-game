// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md → BUG-cupidon-shuffle
//
// Reproduce the biased shuffle in cupidon.start:
//   [...players].sort(() => Math.random() - 0.5)
// This produces a non-uniform distribution — some players end up picked
// significantly more often than others. A proper Fisher-Yates shuffle would
// give each player ~equal probability of being in the pair.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Room, RoomPlayer } from "../../types";
import type { AlcoholState } from "../types";

// Break the framework ↔ rounds circular import by eagerly loading framework
// (and thus the full round registry) before pulling the round under test.
// When a test imports the round module directly, `rounds/index.ts` evaluates
// mid-cycle and hits a TDZ on the partially-initialised round const.
await import("../framework");
const { cupidonRound } = await import("./cupidon");

// Stub setTimeout so the 5s endSpecialRound scheduling doesn't leak between
// test runs. Side-effects of `broadcast` and `endSpecialRound` are harmless
// here because every player has a no-op ws.send stub.
const originalSetTimeout = globalThis.setTimeout;
beforeAll(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  globalThis.setTimeout = ((_fn: () => void, _ms?: number) => 0) as any;
});
afterAll(() => {
  globalThis.setTimeout = originalSetTimeout;
});

function fakeWs() {
  return {
    send: () => {},
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

describe("BUG-cupidon-shuffle — Fisher-Yates vs biased sort", () => {
  test("cupidon.start produces uniform distribution over 1000 runs", () => {
    const counts = new Map<string, number>();
    const ids = ["p1", "p2", "p3", "p4"];
    for (const id of ids) counts.set(id, 0);

    const runs = 1000;
    for (let r = 0; r < runs; r++) {
      const room = makeRoom([
        { clerkId: "p1", username: "A" },
        { clerkId: "p2", username: "B" },
        { clerkId: "p3", username: "C" },
        { clerkId: "p4", username: "D" },
      ]);
      // biome-ignore lint/style/noNonNullAssertion: test setup guarantees
      const state = room.game!.alcoholState!;
      cupidonRound.start(room, state);
      const link = state.cupidLinks[0];
      if (!link) continue;
      counts.set(link[0], (counts.get(link[0]) ?? 0) + 1);
      counts.set(link[1], (counts.get(link[1]) ?? 0) + 1);
    }

    // Uniform ideal: each player appears ~ (runs * 2) / 4 = 500 times.
    const expected = (runs * 2) / ids.length;
    const tolerance = expected * 0.15; // 15% — generous
    for (const id of ids) {
      const c = counts.get(id) ?? 0;
      expect(Math.abs(c - expected)).toBeLessThan(tolerance);
    }
  });
});
