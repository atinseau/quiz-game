import { broadcast } from "../../rooms";
import type { Room } from "../../types";
import { endSpecialRound } from "../framework";
import type { AlcoholState, ServerRound } from "../types";

interface SmatchOrPassState {
  decideur: { clerkId: string; username: string; gender: string };
  receveur: { clerkId: string; username: string; gender: string };
  timeout: ReturnType<typeof setTimeout>;
  resolved: boolean;
}

const smatchOrPassStates = new Map<string, SmatchOrPassState>();

function resolveRound(
  room: Room,
  state: SmatchOrPassState,
  choice: "smatch" | "pass",
) {
  state.resolved = true;
  clearTimeout(state.timeout);
  smatchOrPassStates.delete(room.code);

  broadcast(room, {
    type: "smatch_or_pass_result",
    decideur: state.decideur,
    receveur: state.receveur,
    choice,
  });

  setTimeout(() => endSpecialRound(room), 5000);
}

export const smatchOrPassRound: ServerRound = {
  type: "smatch_or_pass",
  start(room: Room, _state: AlcoholState) {
    const connected = Array.from(room.players.values()).filter(
      (p) => p.connected,
    );

    // Find a pair of players with opposite genders
    const homme = connected.find((p) => p.gender === "homme") ?? null;
    const femme = connected.find((p) => p.gender === "femme") ?? null;

    if (!homme || !femme) {
      endSpecialRound(room);
      return;
    }

    // Randomise who is décideur
    const isSwapped = Math.random() < 0.5;
    const decideurPlayer = isSwapped ? femme : homme;
    const receveurPlayer = isSwapped ? homme : femme;

    const decideur = {
      clerkId: decideurPlayer.clerkId,
      username: decideurPlayer.username,
      gender: decideurPlayer.gender,
    };
    const receveur = {
      clerkId: receveurPlayer.clerkId,
      username: receveurPlayer.username,
      gender: receveurPlayer.gender,
    };

    broadcast(room, {
      type: "special_round_start",
      roundType: "smatch_or_pass",
      data: { decideur, receveur },
    });

    const timeout = setTimeout(() => {
      const s = smatchOrPassStates.get(room.code);
      if (!s || s.resolved) return;
      resolveRound(room, s, "pass");
    }, 30_000);

    smatchOrPassStates.set(room.code, {
      decideur,
      receveur,
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
    if (msg.type !== "smatch_choice") return;

    const s = smatchOrPassStates.get(room.code);
    if (!s || s.resolved) return;
    if (s.decideur.clerkId !== clerkId) return;

    const choice = msg.choice as "smatch" | "pass";
    resolveRound(room, s, choice);
  },
};
