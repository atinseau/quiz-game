import { broadcast } from "../../rooms";
import type { Room } from "../../types";
import { broadcastDrinkAlert, endSpecialRound } from "../framework";
import type { AlcoholState, ServerRound } from "../types";

const conseilState = new Map<
  string,
  { votes: Map<string, string>; timeoutId: ReturnType<typeof setTimeout> }
>();

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

    conseilState.set(room.code, { votes: new Map(), timeoutId });
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
  conseilState.delete(room.code);

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
          .filter(([_, count]) => count === maxVotes)
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

  for (const loserId of loserClerkIds) {
    const loserName = room.players.get(loserId)?.username ?? "?";
    broadcastDrinkAlert(
      room,
      loserId,
      "🗳️",
      `${loserName} a été désigné par le conseil — boit !`,
    );
  }

  setTimeout(() => endSpecialRound(room), 5000);
}
