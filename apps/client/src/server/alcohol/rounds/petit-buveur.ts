import { broadcast } from "../../rooms";
import type { Room } from "../../types";
import { broadcastDrinkAlert, endSpecialRound } from "../framework";
import type { AlcoholState, ServerRound } from "../types";

export const petitBuveurRound: ServerRound = {
  type: "petit_buveur",
  start(room: Room, state: AlcoholState) {
    const game = room.game;
    if (!game) return;

    const minScore = Math.min(...Object.values(game.scores));
    const losers = Object.entries(game.scores)
      .filter(([_, score]) => score === minScore)
      .map(([clerkId]) => ({
        clerkId,
        username: room.players.get(clerkId)?.username ?? "?",
      }));

    // Expand losers with their Cupidon-linked partners. A single aggregated
    // DrinkAlert is shown (not N per drinker), so we pre-merge the names here
    // instead of calling broadcastDrinkAlert per loser — which would emit one
    // message per loser plus one per propagation, replaying the client-side
    // bounce-in animation each time.
    const drinkers = new Map<string, string>();
    for (const l of losers) drinkers.set(l.clerkId, l.username);
    for (const l of losers) {
      for (const [a, b] of state.cupidLinks) {
        const partner = a === l.clerkId ? b : b === l.clerkId ? a : null;
        if (partner && !drinkers.has(partner)) {
          drinkers.set(partner, room.players.get(partner)?.username ?? "?");
        }
      }
    }

    broadcast(room, {
      type: "special_round_start",
      roundType: "petit_buveur",
      data: { losers },
    });
    broadcastDrinkAlert(room, [...drinkers.keys()], "🍺", "boire une gorgée");

    // Align with the client-side `<DrinkAlert>` auto-dismiss duration (4s).
    // petit_buveur has no dedicated overlay card — the DrinkAlert is the whole
    // UX, so ending the round after it closes avoids a 1s stale-UI gap before
    // the next question arrives.
    setTimeout(() => endSpecialRound(room), 4000);
  },
  handleMessage() {},
};
