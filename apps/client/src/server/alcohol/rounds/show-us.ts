import { broadcast } from "../../rooms";
import type { Room } from "../../types";
import { broadcastDrinkAlert, endSpecialRound } from "../framework";
import type { AlcoholState, ServerRound } from "../types";

const COLORS = ["Bleu", "Noir", "Blanc", "Rouge", "Autre"] as const;

interface ShowUsRoomState {
  targetClerkId: string;
  votes: Map<string, string>;
  timeout: ReturnType<typeof setTimeout>;
  revealed: boolean;
}

const showUsState = new Map<string, ShowUsRoomState>();

export const showUsRound: ServerRound = {
  type: "show_us",
  start(room: Room, _state: AlcoholState) {
    const connectedPlayers = Array.from(room.players.entries()).filter(
      ([, p]) => p.connected,
    );
    if (connectedPlayers.length === 0) {
      endSpecialRound(room);
      return;
    }

    const randomIndex = Math.floor(Math.random() * connectedPlayers.length);
    const [targetClerkId, targetPlayer] = connectedPlayers[
      randomIndex
    ] as (typeof connectedPlayers)[0];

    broadcast(room, {
      type: "special_round_start",
      roundType: "show_us",
      data: {
        targetClerkId,
        targetName: targetPlayer.username,
      },
    });

    const timeout = setTimeout(() => {
      const rs = showUsState.get(room.code);
      if (!rs || rs.revealed) return;
      showUsState.delete(room.code);
      broadcast(room, {
        type: "show_us_result",
        correctColor: null,
        wrongClerkIds: [],
        timedOut: true,
      });
      setTimeout(() => endSpecialRound(room), 5000);
    }, 15_000);

    showUsState.set(room.code, {
      targetClerkId,
      votes: new Map(),
      timeout,
      revealed: false,
    });
  },

  handleMessage(
    room: Room,
    _state: AlcoholState,
    clerkId: string,
    msg: Record<string, unknown>,
  ) {
    const rs = showUsState.get(room.code);
    if (!rs) return;

    if (msg.type === "show_us_vote") {
      if (clerkId === rs.targetClerkId) return;
      if (rs.revealed) return;
      const color = msg.color as string;
      if (!COLORS.includes(color as (typeof COLORS)[number])) return;
      rs.votes.set(clerkId, color);
      return;
    }

    if (msg.type === "show_us_reveal") {
      if (clerkId !== rs.targetClerkId) return;
      if (rs.revealed) return;
      const color = msg.color as string;
      if (!COLORS.includes(color as (typeof COLORS)[number])) return;

      rs.revealed = true;
      clearTimeout(rs.timeout);
      showUsState.delete(room.code);

      const wrongClerkIds: string[] = [];
      for (const [voterId, vote] of rs.votes.entries()) {
        if (vote !== color) {
          wrongClerkIds.push(voterId);
          const voter = room.players.get(voterId);
          broadcastDrinkAlert(
            room,
            voterId,
            "🍺",
            `${voter?.username ?? "?"} s'est planté — boit une gorgée !`,
          );
        }
      }

      broadcast(room, {
        type: "show_us_result",
        correctColor: color,
        wrongClerkIds,
        timedOut: false,
      });

      setTimeout(() => endSpecialRound(room), 5000);
    }
  },
};
