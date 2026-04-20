// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md → BUG-smatch-non-random
//
// Reproduce the non-random selection in smatch-or-pass.start:
//   connected.find(p => p.gender === "homme")
//   connected.find(p => p.gender === "femme")
// find() returns the FIRST match, so the same player (insertion-order first)
// is picked every time. A proper implementation should randomise within each
// gender sub-group so every homme / every femme has an equal chance.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Room, RoomPlayer } from "../../types";
import type { AlcoholState } from "../types";

// Break the framework ↔ rounds circular import — see cupidon.test.ts.
await import("../framework");
const { smatchOrPassRound } = await import("./smatch-or-pass");

const originalSetTimeout = globalThis.setTimeout;
beforeAll(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  globalThis.setTimeout = ((_fn: () => void, _ms?: number) => 0) as any;
});
afterAll(() => {
  globalThis.setTimeout = originalSetTimeout;
});

// Capture every ServerMessage emitted via broadcast() by spying on ws.send.
// `broadcast` stringifies the message and sends it to every connected player,
// so we attach a send() that pushes parsed JSON into this list.
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

function makePlayer(
  clerkId: string,
  username: string,
  gender: "homme" | "femme",
): RoomPlayer {
  return {
    clerkId,
    username,
    gender,
    ws: fakeWs(),
    connected: true,
    disconnectedAt: null,
    graceTimer: null,
  };
}

function makeRoom(
  playerSpecs: {
    clerkId: string;
    username: string;
    gender: "homme" | "femme";
  }[],
): Room {
  const map = new Map<string, RoomPlayer>();
  for (const p of playerSpecs)
    map.set(p.clerkId, makePlayer(p.clerkId, p.username, p.gender));
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

describe("BUG-smatch-non-random — find() picks first, not random", () => {
  test("smatchOrPass.start picks a random homme/femme over many runs", () => {
    const hommeCounts = new Map<string, number>();
    const femmeCounts = new Map<string, number>();
    const hommeIds = ["h1", "h2", "h3"];
    const femmeIds = ["f1", "f2", "f3"];
    for (const id of hommeIds) hommeCounts.set(id, 0);
    for (const id of femmeIds) femmeCounts.set(id, 0);

    const runs = 500;
    for (let r = 0; r < runs; r++) {
      captured.length = 0;
      // Fresh room each run, same insertion order → find() always picks h1/f1.
      // Randomness must come from something other than the gender scan.
      const room = makeRoom([
        { clerkId: "h1", username: "H1", gender: "homme" },
        { clerkId: "h2", username: "H2", gender: "homme" },
        { clerkId: "h3", username: "H3", gender: "homme" },
        { clerkId: "f1", username: "F1", gender: "femme" },
        { clerkId: "f2", username: "F2", gender: "femme" },
        { clerkId: "f3", username: "F3", gender: "femme" },
      ]);
      // biome-ignore lint/style/noNonNullAssertion: test setup guarantees
      const state = room.game!.alcoholState!;
      smatchOrPassRound.start(room, state);

      const start = captured.find((m) => m.type === "special_round_start");
      if (!start) continue;
      const data = start.data as {
        decideur: { clerkId: string; gender: string };
        receveur: { clerkId: string; gender: string };
      };

      const hommeId =
        data.decideur.gender === "homme"
          ? data.decideur.clerkId
          : data.receveur.clerkId;
      const femmeId =
        data.decideur.gender === "femme"
          ? data.decideur.clerkId
          : data.receveur.clerkId;

      hommeCounts.set(hommeId, (hommeCounts.get(hommeId) ?? 0) + 1);
      femmeCounts.set(femmeId, (femmeCounts.get(femmeId) ?? 0) + 1);
    }

    const expected = runs / 3;
    const tolerance = expected * 0.25; // 25% — generous
    for (const id of hommeIds) {
      const c = hommeCounts.get(id) ?? 0;
      expect(Math.abs(c - expected)).toBeLessThan(tolerance);
    }
    for (const id of femmeIds) {
      const c = femmeCounts.get(id) ?? 0;
      expect(Math.abs(c - expected)).toBeLessThan(tolerance);
    }
  });
});
