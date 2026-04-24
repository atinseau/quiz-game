import { broadcast } from "../../rooms";
import type { Room } from "../../types";
import {
  broadcastDrinkAlert,
  endSpecialRound,
  shuffleArray,
} from "../framework";
import type { AlcoholState, ServerRound } from "../types";

type ConseilState = {
  votes: Map<string, string>;
  timeoutId: ReturnType<typeof setTimeout>;
  phase: "vote" | "tiebreaker" | "done";
  tiebreakerTimeoutId?: ReturnType<typeof setTimeout>;
  tiedClerkIds?: string[];
  selectedClerkId?: string;
  spinStartedAt?: number;
};

const conseilState = new Map<string, ConseilState>();

const REVEAL_DURATION = 1500;
const SPIN_DURATION = 4000;
const SETTLE_DURATION = 800;

export const conseilRound: ServerRound = {
  type: "conseil",
  start(room: Room, _state: AlcoholState) {
    const game = room.game;
    if (!game) {
      endSpecialRound(room);
      return;
    }

    const connectedPlayers = Array.from(room.players.values()).filter(
      (p) => p.connected,
    );

    if (connectedPlayers.length < 2) {
      endSpecialRound(room);
      return;
    }

    broadcast(room, {
      type: "special_round_start",
      roundType: "conseil",
      data: {
        players: connectedPlayers.map((p) => ({
          clerkId: p.clerkId,
          username: p.username,
        })),
      },
    });

    const timeoutId = setTimeout(() => {
      resolveVotes(room);
    }, 30_000);

    conseilState.set(room.code, {
      votes: new Map(),
      timeoutId,
      phase: "vote",
    });
  },

  handleMessage(
    room: Room,
    _state: AlcoholState,
    clerkId: string,
    msg: Record<string, unknown>,
  ) {
    if (msg.type !== "conseil_vote") return;

    const cs = conseilState.get(room.code);
    if (!cs) return;
    if (cs.phase !== "vote") return;

    const targetClerkId = msg.targetClerkId as string;
    if (targetClerkId === clerkId) return;

    // Record vote (overwrite if already voted)
    cs.votes.set(clerkId, targetClerkId);

    // Check if all connected players have voted
    const connectedPlayers = Array.from(room.players.values()).filter(
      (p) => p.connected,
    );
    const allVoted = connectedPlayers.every((p) => cs.votes.has(p.clerkId));

    if (allVoted) {
      clearTimeout(cs.timeoutId);
      resolveVotes(room);
    }
  },
};

function resolveVotes(room: Room): void {
  const cs = conseilState.get(room.code);
  if (!cs) {
    endSpecialRound(room);
    return;
  }

  // Count votes per target
  const voteCounts = new Map<string, number>();
  for (const targetId of cs.votes.values()) {
    voteCounts.set(targetId, (voteCounts.get(targetId) ?? 0) + 1);
  }
  const maxVotes = Math.max(0, ...voteCounts.values());
  const loserClerkIds =
    maxVotes > 0
      ? Array.from(voteCounts.entries())
          .filter(([, count]) => count === maxVotes)
          .map(([clerkId]) => clerkId)
      : [];

  // Build votes record for the result payload
  const votesRecord: Record<string, string> = {};
  for (const [voter, target] of cs.votes.entries()) {
    votesRecord[voter] = target;
  }

  broadcast(room, {
    type: "conseil_result",
    votes: votesRecord,
    loserClerkIds,
  });

  if (loserClerkIds.length <= 1) {
    // Mono-loser or zero-vote path — finalize directly (no wheel).
    finalizeConseil(room, loserClerkIds[0]);
    return;
  }

  // Tiebreaker path — pick a single loser via shuffleArray and spin the wheel.
  const firstPick = shuffleArray(loserClerkIds)[0];
  if (!firstPick) {
    finalizeConseil(room, undefined);
    return;
  }
  const selectedClerkId = firstPick;
  cs.phase = "tiebreaker";
  cs.tiedClerkIds = loserClerkIds;
  cs.selectedClerkId = selectedClerkId;
  cs.spinStartedAt = Date.now();

  broadcast(room, {
    type: "conseil_tiebreaker",
    tiedClerkIds: loserClerkIds,
    selectedClerkId,
    spinDurationMs: SPIN_DURATION,
  });

  cs.tiebreakerTimeoutId = setTimeout(
    () => finalizeConseil(room, selectedClerkId),
    REVEAL_DURATION + SPIN_DURATION + SETTLE_DURATION,
  );
}

function finalizeConseil(room: Room, loserId: string | undefined): void {
  const cs = conseilState.get(room.code);
  // Idempotent: once the first finalize runs and clears state, any stray
  // second call (e.g. a timeout firing after finalize already ran on
  // all-voted) is a no-op. Without this guard a duplicate would re-fire the
  // drink alert and schedule a second endSpecialRound.
  if (!cs) return;
  cs.phase = "done";
  conseilState.delete(room.code);

  if (loserId) {
    broadcastDrinkAlert(room, [loserId], "🗳️", "boire une gorgée");
  }

  setTimeout(() => endSpecialRound(room), 5000);
}

/**
 * Clear any in-flight Conseil state/timers for a room. Called by rooms.ts
 * on deleteRoom so the 30s vote timer and the REVEAL+SPIN+SETTLE timeout
 * don't fire against a dead room.
 */
export function cleanupConseilRoom(roomCode: string): void {
  const cs = conseilState.get(roomCode);
  if (!cs) return;
  clearTimeout(cs.timeoutId);
  if (cs.tiebreakerTimeoutId) clearTimeout(cs.tiebreakerTimeoutId);
  conseilState.delete(roomCode);
}

// Test-only: expose resolveVotes so unit tests can simulate the 30s vote
// timeout without real timers. Consumers other than tests MUST NOT use this.
export const _resolveVotesForTest = resolveVotes;

export type ConseilSnapshot =
  | { phase: "vote" }
  | {
      phase: "tiebreaker";
      tiedClerkIds: string[];
      selectedClerkId: string;
      spinStartedAt: number;
      spinDurationMs: number;
    };

/**
 * Read-only snapshot of the Conseil state for a room, used by the
 * `room_joined` payload so reconnecting clients can catch up to the
 * current phase instead of replaying from the vote screen (or flashing
 * straight to the result without the wheel animation). Returns `null`
 * when there's no active Conseil round or when tiebreaker fields are
 * not yet populated.
 */
export function getConseilSnapshot(roomCode: string): ConseilSnapshot | null {
  const cs = conseilState.get(roomCode);
  if (!cs) return null;
  if (cs.phase === "done") return null;
  if (cs.phase !== "tiebreaker") return { phase: cs.phase };
  if (
    !cs.tiedClerkIds ||
    !cs.selectedClerkId ||
    cs.spinStartedAt === undefined
  ) {
    return null;
  }
  return {
    phase: cs.phase,
    tiedClerkIds: cs.tiedClerkIds,
    selectedClerkId: cs.selectedClerkId,
    spinStartedAt: cs.spinStartedAt,
    spinDurationMs: SPIN_DURATION,
  };
}
