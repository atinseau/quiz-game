import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Room, RoomPlayer } from "../types";
import type { AlcoholState } from "./types";

// Break the framework ↔ rounds circular import.
await import("./framework");
const { broadcastDrinkAlert } = await import("./framework");

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

function makeRoom(
  playerSpecs: { clerkId: string; username: string }[],
  cupidLinks: [string, string][] = [],
): Room {
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

/** Number of distinct logical broadcasts of a given type.
 * broadcast(room, msg) sends once per connected player ws, so divide
 * by player count to get logical broadcast count. */
function logicalCount(room: Room, type: string): number {
  const playerCount = room.players.size;
  const total = captured.filter((m) => m.type === type).length;
  return playerCount > 0 ? total / playerCount : 0;
}

describe("broadcastDrinkAlert", () => {
  test("emits a single drink_alert with new payload shape", () => {
    captured.length = 0;
    const room = makeRoom([
      { clerkId: "alice", username: "Alice" },
      { clerkId: "bob", username: "Bob" },
      { clerkId: "carol", username: "Carol" },
    ]);
    broadcastDrinkAlert(room, ["alice"], "🗳️", "boire une gorgée");
    expect(logicalCount(room, "drink_alert")).toBe(1);
    const alert = captured.find((m) => m.type === "drink_alert") as
      | { targetClerkIds: string[]; emoji: string; action: string }
      | undefined;
    expect(alert).toMatchObject({
      type: "drink_alert",
      targetClerkIds: ["alice"],
      emoji: "🗳️",
      action: "boire une gorgée",
    });
  });

  test("accepts multiple targets in a single alert", () => {
    captured.length = 0;
    const room = makeRoom([
      { clerkId: "alice", username: "Alice" },
      { clerkId: "bob", username: "Bob" },
      { clerkId: "carol", username: "Carol" },
    ]);
    broadcastDrinkAlert(room, ["alice", "bob"], "🍺", "boire une gorgée");
    expect(logicalCount(room, "drink_alert")).toBe(1);
    const alert = captured.find((m) => m.type === "drink_alert") as
      | { targetClerkIds: string[] }
      | undefined;
    expect(alert?.targetClerkIds).toEqual(["alice", "bob"]);
  });

  test("Cupidon propagation emits a second alert for the linked partner", () => {
    captured.length = 0;
    const room = makeRoom(
      [
        { clerkId: "alice", username: "Alice" },
        { clerkId: "bob", username: "Bob" },
        { clerkId: "carol", username: "Carol" },
      ],
      [["alice", "carol"]],
    );
    broadcastDrinkAlert(room, ["alice"], "🗳️", "boire une gorgée");
    expect(logicalCount(room, "drink_alert")).toBe(2);
    const alerts = captured.filter((m) => m.type === "drink_alert") as {
      targetClerkIds: string[];
      emoji: string;
      action: string;
    }[];
    // De-duplicate — each logical broadcast appears player-count times
    const unique = alerts.filter(
      (a, i, arr) =>
        arr.findIndex(
          (b) =>
            JSON.stringify(b.targetClerkIds) ===
            JSON.stringify(a.targetClerkIds),
        ) === i,
    );
    expect(unique[0]?.targetClerkIds).toEqual(["alice"]);
    expect(unique[1]?.targetClerkIds).toEqual(["carol"]);
    expect(unique[1]?.emoji).toBe("💘");
    expect(unique[1]?.action).toContain("lié au cœur");
  });

  test("Cupidon does not double-fire when both ends are already in targetClerkIds", () => {
    captured.length = 0;
    const room = makeRoom(
      [
        { clerkId: "alice", username: "Alice" },
        { clerkId: "bob", username: "Bob" },
        { clerkId: "carol", username: "Carol" },
      ],
      [["alice", "bob"]],
    );
    broadcastDrinkAlert(room, ["alice", "bob"], "🍺", "boire");
    expect(logicalCount(room, "drink_alert")).toBe(1);
  });
});
