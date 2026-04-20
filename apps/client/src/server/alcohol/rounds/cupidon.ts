import { broadcast } from "../../rooms";
import type { Room } from "../../types";
import { endSpecialRound, shuffleArray } from "../framework";
import type { AlcoholState, ServerRound } from "../types";

export const cupidonRound: ServerRound = {
  type: "cupidon",
  start(room: Room, state: AlcoholState) {
    const players = Array.from(room.players.values());
    if (players.length < 2) {
      setTimeout(() => endSpecialRound(room), 5000);
      return;
    }

    const shuffled = shuffleArray(players);
    // biome-ignore lint/style/noNonNullAssertion: length >= 2 guaranteed above
    const playerA = shuffled[0]!;
    // biome-ignore lint/style/noNonNullAssertion: length >= 2 guaranteed above
    const playerB = shuffled[1]!;

    state.cupidLinks.push([playerA.clerkId, playerB.clerkId]);

    broadcast(room, {
      type: "special_round_start",
      roundType: "cupidon",
      data: {
        playerA: { clerkId: playerA.clerkId, username: playerA.username },
        playerB: { clerkId: playerB.clerkId, username: playerB.username },
      },
    });

    setTimeout(() => endSpecialRound(room), 5000);
  },
  handleMessage() {},
};
