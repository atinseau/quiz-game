// Unit tests for the Conseil tiebreaker refactor.
//
// When >= 2 players tie for max votes, resolveVotes now enters a tiebreaker
// phase instead of making everyone drink. The server picks ONE loser via
// shuffleArray, broadcasts `conseil_tiebreaker`, and fires a single
// `drink_alert` after the reveal + spin + settle window.
//
// Mono-loser and zero-vote paths stay externally identical (no tiebreaker).

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Room, RoomPlayer, ServerMessage } from "../../types";
import type { AlcoholState } from "../types";

// Break the framework ↔ rounds circular import before importing the round.
await import("../framework");
const { _resolveVotesForTest, conseilRound } = (await import(
  "./conseil"
)) as typeof import("./conseil");

const originalSetTimeout = globalThis.setTimeout;
const originalRandom = Math.random;

beforeAll(() => {
  // Neuter setTimeout so the 30s vote timer and the reveal/spin/settle
  // timers don't leak between runs. `resolveVotes` is still driven directly
  // by `handleMessage` (all-voted path) and by `_resolveVotesForTest`.
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  globalThis.setTimeout = ((_fn: () => void, _ms?: number) => 0) as any;
  // shuffleArray uses Math.floor(Math.random() * (i + 1)). With random === 0,
  // the swap picks index 0 every iteration, so shuffleArray returns a copy
  // with the original order preserved. This keeps `tiedClerkIds[0]` stable
  // across tests (insertion order = vote tally iteration order).
  globalThis.Math.random = () => 0;
});

afterAll(() => {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.Math.random = originalRandom;
});

function makeWs(sink: ServerMessage[]) {
  return {
    send: (payload: string) => {
      try {
        sink.push(JSON.parse(payload) as ServerMessage);
      } catch {
        // ignore
      }
    },
    readyState: 1,
    // biome-ignore lint/suspicious/noExplicitAny: test stub
  } as any;
}

function makePlayer(clerkId: string, sink: ServerMessage[]): RoomPlayer {
  return {
    clerkId,
    username: clerkId,
    gender: "homme",
    ws: makeWs(sink),
    connected: true,
    disconnectedAt: null,
    graceTimer: null,
  };
}

/**
 * `broadcast` sends the same payload to every connected player's ws. To
 * recover the logical message stream we dedupe by JSON identity, keeping
 * only the first occurrence in emission order.
 */
function uniqueBroadcasts(raw: ServerMessage[]): ServerMessage[] {
  const seen = new Set<string>();
  const out: ServerMessage[] = [];
  for (const m of raw) {
    const key = JSON.stringify(m);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function makeRoom(playerIds: string[]): {
  room: Room;
  sent: () => ServerMessage[];
} {
  const raw: ServerMessage[] = [];
  const players = new Map<string, RoomPlayer>();
  for (const id of playerIds) players.set(id, makePlayer(id, raw));

  const alcoholState: AlcoholState = {
    config: {
      enabled: true,
      frequency: 3,
      enabledRounds: [],
      culSecEndGame: false,
    },
    turnsSinceLastSpecial: 0,
    specialRoundQueue: [],
    activeRound: "conseil",
    cupidLinks: [],
    usedByCourage: new Set(),
  };

  const room = {
    code: `TEST-${Math.random().toString(36).slice(2)}`,
    hostClerkId: playerIds[0] ?? "",
    players,
    status: "playing",
    mode: "classic",
    packSlug: "test",
    game: {
      questions: [],
      currentQuestionIndex: 0,
      currentPlayerIndex: 0,
      scores: {},
      combos: {},
      answers: new Map(),
      questionStartedAt: 0,
      resolved: false,
      alcoholState,
    },
    alcoholConfig: null,
    endedAt: null,
    nextQuestionTimer: null,
  } as unknown as Room;

  return { room, sent: () => uniqueBroadcasts(raw) };
}

function typesOf(sent: ServerMessage[]): string[] {
  return sent.map((m) => m.type);
}

describe("conseilRound", () => {
  test("mono-loser: emits conseil_result + drink_alert, no tiebreaker", () => {
    const { room, sent } = makeRoom(["alice", "bob", "carol"]);
    conseilRound.start(room, {} as AlcoholState);
    conseilRound.handleMessage(room, {} as AlcoholState, "alice", {
      type: "conseil_vote",
      targetClerkId: "bob",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "bob", {
      type: "conseil_vote",
      targetClerkId: "carol",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "carol", {
      type: "conseil_vote",
      targetClerkId: "bob",
    });
    const msgs = sent();
    expect(typesOf(msgs)).toContain("conseil_result");
    expect(typesOf(msgs)).not.toContain("conseil_tiebreaker");
    const drink = msgs.find((m) => m.type === "drink_alert");
    expect(drink).toBeDefined();
    // biome-ignore lint/suspicious/noExplicitAny: narrowing discriminated union
    expect((drink as any).targetClerkIds).toEqual(["bob"]);
  });

  test("3-way tie: emits conseil_tiebreaker with selectedClerkId in tiedClerkIds", () => {
    const { room, sent } = makeRoom(["alice", "bob", "carol"]);
    conseilRound.start(room, {} as AlcoholState);
    conseilRound.handleMessage(room, {} as AlcoholState, "alice", {
      type: "conseil_vote",
      targetClerkId: "bob",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "bob", {
      type: "conseil_vote",
      targetClerkId: "carol",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "carol", {
      type: "conseil_vote",
      targetClerkId: "alice",
    });
    const msgs = sent();
    const tieMsg = msgs.find((m) => m.type === "conseil_tiebreaker");
    expect(tieMsg).toBeDefined();
    // biome-ignore lint/suspicious/noExplicitAny: narrowing discriminated union
    const t = tieMsg as any;
    expect(t.tiedClerkIds).toHaveLength(3);
    expect(t.tiedClerkIds).toContain(t.selectedClerkId);
    expect(t.spinDurationMs).toBe(4000);
  });

  test("2-way tie: same tiebreaker path with 2 tied ids", () => {
    const { room, sent } = makeRoom(["alice", "bob", "carol", "dave"]);
    conseilRound.start(room, {} as AlcoholState);
    conseilRound.handleMessage(room, {} as AlcoholState, "alice", {
      type: "conseil_vote",
      targetClerkId: "bob",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "bob", {
      type: "conseil_vote",
      targetClerkId: "alice",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "carol", {
      type: "conseil_vote",
      targetClerkId: "alice",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "dave", {
      type: "conseil_vote",
      targetClerkId: "bob",
    });
    const msgs = sent();
    const tieMsg = msgs.find((m) => m.type === "conseil_tiebreaker");
    expect(tieMsg).toBeDefined();
    // biome-ignore lint/suspicious/noExplicitAny: narrowing discriminated union
    expect((tieMsg as any).tiedClerkIds.slice().sort()).toEqual([
      "alice",
      "bob",
    ]);
  });

  test("0 votes (timeout path): no tiebreaker, no drink_alert", () => {
    const { room, sent } = makeRoom(["alice", "bob"]);
    conseilRound.start(room, {} as AlcoholState);
    // Simulate the 30s timeout by invoking the test-only hook directly.
    _resolveVotesForTest(room);
    const msgs = sent();
    expect(typesOf(msgs)).toContain("conseil_result");
    expect(typesOf(msgs)).not.toContain("conseil_tiebreaker");
    expect(typesOf(msgs)).not.toContain("drink_alert");
  });

  test("vote after tiebreaker phase is silently rejected", () => {
    const { room, sent } = makeRoom(["alice", "bob", "carol"]);
    conseilRound.start(room, {} as AlcoholState);
    conseilRound.handleMessage(room, {} as AlcoholState, "alice", {
      type: "conseil_vote",
      targetClerkId: "bob",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "bob", {
      type: "conseil_vote",
      targetClerkId: "carol",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "carol", {
      type: "conseil_vote",
      targetClerkId: "alice",
    });
    // Tie triggered → any further vote should be silently rejected.
    const before = sent().length;
    conseilRound.handleMessage(room, {} as AlcoholState, "alice", {
      type: "conseil_vote",
      targetClerkId: "carol",
    });
    expect(sent().length).toBe(before);
  });
});
