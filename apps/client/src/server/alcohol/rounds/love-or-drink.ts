import { broadcast } from "../../rooms";
import type { Room } from "../../types";
import { broadcastDrinkAlert, endSpecialRound } from "../framework";
import type { AlcoholState, ServerRound } from "../types";

interface LoveOrDrinkState {
  players: { clerkId: string; username: string }[];
  timeout: ReturnType<typeof setTimeout>;
  resolved: boolean;
}

const loveOrDrinkStates = new Map<string, LoveOrDrinkState>();

export const loveOrDrinkRound: ServerRound = {
  type: "love_or_drink",
  start(room: Room, _state: AlcoholState) {
    const game = room.game;
    if (!game) return;

    const scores = game.scores;
    const playerIds = Array.from(room.players.keys());

    if (playerIds.length < 2) {
      endSpecialRound(room);
      return;
    }

    const sorted = [...playerIds].sort(
      (a, b) => (scores[a] ?? 0) - (scores[b] ?? 0),
    );
    const bottom2 = sorted.slice(0, 2).map((clerkId) => ({
      clerkId,
      username: room.players.get(clerkId)?.username ?? "?",
    }));

    broadcast(room, {
      type: "special_round_start",
      roundType: "love_or_drink",
      data: { players: bottom2 },
    });

    const timeout = setTimeout(() => {
      const ls = loveOrDrinkStates.get(room.code);
      if (!ls || ls.resolved) return;
      ls.resolved = true;
      loveOrDrinkStates.delete(room.code);

      broadcastDrinkAlert(
        room,
        bottom2.map((p) => p.clerkId),
        "🍺",
        "faire cul-sec — Love or Drink",
      );
      broadcast(room, {
        type: "love_or_drink_result",
        choice: "cul_sec",
        players: bottom2,
      });
      setTimeout(() => endSpecialRound(room), 5000);
    }, 30_000);

    loveOrDrinkStates.set(room.code, {
      players: bottom2,
      timeout,
      resolved: false,
    });
  },

  handleMessage(
    room: Room,
    _state: AlcoholState,
    clerkId: string,
    msg: Record<string, unknown>,
  ) {
    if (msg.type !== "love_or_drink_choice") return;

    const ls = loveOrDrinkStates.get(room.code);
    if (!ls || ls.resolved) return;

    const isParticipant = ls.players.some((p) => p.clerkId === clerkId);
    if (!isParticipant) return;

    ls.resolved = true;
    clearTimeout(ls.timeout);
    loveOrDrinkStates.delete(room.code);

    const choice = msg.choice as "bisou" | "cul_sec";

    if (choice === "cul_sec") {
      broadcastDrinkAlert(
        room,
        ls.players.map((p) => p.clerkId),
        "🍺",
        "faire cul-sec — Love or Drink",
      );
    }

    broadcast(room, {
      type: "love_or_drink_result",
      choice,
      players: ls.players,
    });

    setTimeout(() => endSpecialRound(room), 5000);
  },
};
