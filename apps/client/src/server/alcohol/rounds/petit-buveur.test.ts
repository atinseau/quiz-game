// Regression guards for petit_buveur server broadcasts.
//
// Bug: with N tied losers the round emitted N `drink_alert` messages. Each
// message triggered a separate `<DrinkAlert>` mount on the client FIFO queue,
// so the bounce-in animation replayed N times back to back. Expected: a
// single aggregated alert per round.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Room, RoomPlayer } from "../../types";
import type { AlcoholState } from "../types";

// Break the framework ↔ rounds circular import.
await import("../framework");
const { petitBuveurRound } = await import("./petit-buveur");

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
        // ignore
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

function makeRoom(
  playerSpecs: { clerkId: string; username: string }[],
  scores: Record<string, number>,
  cupidLinks: [string, string][] = [],
): Room {
  const map = new Map<string, RoomPlayer>();
  for (const p of playerSpecs)
    map.set(p.clerkId, makePlayer(p.clerkId, p.username));
  const combos: Record<string, number> = {};
  for (const p of playerSpecs) combos[p.clerkId] = 0;
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
    cupidLinks,
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

function countByType(type: string) {
  // Each broadcast(room, msg) sends the same msg through every player's ws,
  // so one logical broadcast shows up once per connected player. Divide by
  // player count to get the number of distinct broadcasts.
  return captured.filter((m) => m.type === type).length;
}

describe("petit_buveur server broadcasts", () => {
  test("emits a single drink_alert even with multiple tied losers", () => {
    captured.length = 0;
    const players = [
      { clerkId: "p1", username: "Alice" },
      { clerkId: "p2", username: "Bob" },
      { clerkId: "p3", username: "Charlie" },
    ];
    const room = makeRoom(players, { p1: 0, p2: 0, p3: 5 });
    // biome-ignore lint/style/noNonNullAssertion: test setup guarantees
    const state = room.game!.alcoholState!;

    petitBuveurRound.start(room, state);

    // 3 players → each broadcast lands 3 ws.send calls. So one logical
    // drink_alert = 3 captured sends.
    const drinkAlertSends = countByType("drink_alert");
    expect(drinkAlertSends).toBe(3);
  });

  test("emits a single drink_alert with exactly one loser", () => {
    captured.length = 0;
    const players = [
      { clerkId: "p1", username: "Alice" },
      { clerkId: "p2", username: "Bob" },
    ];
    const room = makeRoom(players, { p1: 0, p2: 5 });
    // biome-ignore lint/style/noNonNullAssertion: test setup guarantees
    const state = room.game!.alcoholState!;

    petitBuveurRound.start(room, state);

    // 2 players → 1 drink_alert × 2 ws.send = 2.
    expect(countByType("drink_alert")).toBe(2);
  });

  test("aggregated alert targets all tied losers", () => {
    captured.length = 0;
    const players = [
      { clerkId: "p1", username: "Alice" },
      { clerkId: "p2", username: "Bob" },
    ];
    const room = makeRoom(players, { p1: 0, p2: 0 });
    // biome-ignore lint/style/noNonNullAssertion: test setup guarantees
    const state = room.game!.alcoholState!;

    petitBuveurRound.start(room, state);

    const drinkAlert = captured.find((m) => m.type === "drink_alert") as
      | { targetClerkIds: string[]; action: string }
      | undefined;
    expect(drinkAlert).toBeDefined();
    expect(drinkAlert?.targetClerkIds).toContain("p1");
    expect(drinkAlert?.targetClerkIds).toContain("p2");
    expect(drinkAlert?.action).toBe("boire une gorgée");
  });

  test("does not double-emit when a loser is Cupidon-linked", () => {
    captured.length = 0;
    const players = [
      { clerkId: "p1", username: "Alice" },
      { clerkId: "p2", username: "Bob" },
      { clerkId: "p3", username: "Charlie" },
    ];
    // Alice is the only loser, but she's linked to Bob. Pre-fix, Cupidon
    // propagation emitted a second drink_alert for Bob.
    const room = makeRoom(players, { p1: 0, p2: 5, p3: 5 }, [["p1", "p2"]]);
    // biome-ignore lint/style/noNonNullAssertion: test setup guarantees
    const state = room.game!.alcoholState!;

    petitBuveurRound.start(room, state);

    // Still 1 logical drink_alert × 3 players = 3 sends. Bob's clerkId should
    // be included in the aggregated targetClerkIds (Cupidon-linked partner).
    expect(countByType("drink_alert")).toBe(3);
    const drinkAlert = captured.find((m) => m.type === "drink_alert") as
      | { targetClerkIds: string[] }
      | undefined;
    expect(drinkAlert?.targetClerkIds).toContain("p1");
    expect(drinkAlert?.targetClerkIds).toContain("p2");
  });
});
