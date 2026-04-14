import { broadcast } from "../../rooms";
import type { Room } from "../../types";
import { broadcastDrinkAlert, endSpecialRound } from "../framework";
import type { AlcoholState, ServerRound } from "../types";

const distributorState = new Map<
  string,
  { remaining: number; timeoutId: ReturnType<typeof setTimeout> }
>();

export const distributeurRound: ServerRound = {
  type: "distributeur",
  start(room: Room, _state: AlcoholState) {
    const game = room.game;
    if (!game) {
      endSpecialRound(room);
      return;
    }
    const maxScore = Math.max(...Object.values(game.scores));
    const winnerId = Object.entries(game.scores).find(
      ([_, s]) => s === maxScore,
    )?.[0];
    if (!winnerId) {
      endSpecialRound(room);
      return;
    }
    const winner = room.players.get(winnerId);
    broadcast(room, {
      type: "special_round_start",
      roundType: "distributeur",
      data: {
        distributorClerkId: winnerId,
        distributorName: winner?.username ?? "?",
      },
    });
    broadcast(room, {
      type: "distribute_prompt",
      distributorClerkId: winnerId,
      remaining: 3,
    });
    const timeoutId = setTimeout(() => {
      distributorState.delete(room.code);
      endSpecialRound(room);
    }, 30_000);
    distributorState.set(room.code, { remaining: 3, timeoutId });
  },
  handleMessage(
    room: Room,
    _state: AlcoholState,
    clerkId: string,
    msg: Record<string, unknown>,
  ) {
    if (msg.type !== "distribute_drink") return;
    const ds = distributorState.get(room.code);
    if (!ds || ds.remaining <= 0) return;
    const targetClerkId = msg.targetClerkId as string;
    const distributor = room.players.get(clerkId);
    broadcastDrinkAlert(
      room,
      targetClerkId,
      "🍺",
      `${distributor?.username ?? "?"} t'envoie une gorgée !`,
    );
    ds.remaining--;
    if (ds.remaining <= 0) {
      clearTimeout(ds.timeoutId);
      distributorState.delete(room.code);
      setTimeout(() => endSpecialRound(room), 2000);
    } else {
      broadcast(room, {
        type: "distribute_prompt",
        distributorClerkId: clerkId,
        remaining: ds.remaining,
      });
    }
  },
};
