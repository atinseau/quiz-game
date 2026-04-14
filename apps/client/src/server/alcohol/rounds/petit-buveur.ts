import { broadcast } from "../../rooms";
import type { Room } from "../../types";
import { broadcastDrinkAlert, endSpecialRound } from "../framework";
import type { AlcoholState, ServerRound } from "../types";

export const petitBuveurRound: ServerRound = {
  type: "petit_buveur",
  start(room: Room, _state: AlcoholState) {
    const game = room.game;
    if (!game) return;
    const minScore = Math.min(...Object.values(game.scores));
    const losers = Object.entries(game.scores)
      .filter(([_, score]) => score === minScore)
      .map(([clerkId]) => ({
        clerkId,
        username: room.players.get(clerkId)?.username ?? "?",
      }));
    broadcast(room, {
      type: "special_round_start",
      roundType: "petit_buveur",
      data: { losers },
    });
    for (const loser of losers) {
      broadcastDrinkAlert(
        room,
        loser.clerkId,
        "🍺",
        `${loser.username} boit une gorgée !`,
      );
    }
    setTimeout(() => endSpecialRound(room), 5000);
  },
  handleMessage() {},
};
