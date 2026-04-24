import type { DrinkAlertDetails } from "../../shared/types";
import { broadcast } from "../rooms";
import type { ClientMessage, Room } from "../types";
import { roundRegistry } from "./rounds";
import type { AlcoholConfig, AlcoholState, SpecialRoundType } from "./types";

// ---------------------------------------------------------------------------
// Callback wired by game-engine to avoid circular imports
// ---------------------------------------------------------------------------

// `var` (not `let`) to avoid a TDZ error: game-engine.ts calls setOnRoundEnd at
// module top-level while this file is still mid-evaluation through the cycle
// framework → rooms → game-engine → framework. A `let`/`const` initializer
// would run only AFTER the cycle (because declarations without an initializer
// are the only ones hoisted), while a `var` declaration is hoisted to the
// top of the module with value `undefined`, so setOnRoundEnd can assign to it
// during the cyclic traversal.
//
// CRITICAL: do NOT give this variable an initializer (`= null`). The
// initializer would run AFTER the cycle finishes, wiping out the callback
// that game-engine set during the cycle. Silent bug: special rounds would
// never resume the game because _onRoundEnd was reset right before the first
// round fires.
// eslint-disable-next-line no-var
var _onRoundEnd: ((room: Room) => void) | null;

export function setOnRoundEnd(cb: (room: Room) => void): void {
  _onRoundEnd = cb;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = tmp;
  }
  return copy;
}

export function initAlcoholState(config: AlcoholConfig): AlcoholState {
  return {
    config,
    turnsSinceLastSpecial: 0,
    specialRoundQueue: shuffleArray([...config.enabledRounds]),
    activeRound: null,
    cupidLinks: [],
    usedByCourage: new Set(),
  };
}

// ---------------------------------------------------------------------------
// Drink alert with Cupidon propagation
// ---------------------------------------------------------------------------

export function broadcastDrinkAlert(
  room: Room,
  targetClerkIds: string[],
  emoji: string,
  action: string,
  details?: DrinkAlertDetails,
): void {
  broadcast(room, {
    type: "drink_alert",
    targetClerkIds,
    emoji,
    action,
    details,
  });
  // Cupidon propagation — pour chaque cible qui a un partenaire lié,
  // envoyer une alerte dédiée au partenaire (sauf s'il est déjà dans targetClerkIds).
  const links = room.game?.alcoholState?.cupidLinks ?? [];
  const alreadyTargeted = new Set(targetClerkIds);
  const cupidonPartners = new Set<string>();
  for (const targetId of targetClerkIds) {
    for (const [a, b] of links) {
      if (a === targetId || b === targetId) {
        const partner = a === targetId ? b : a;
        if (!alreadyTargeted.has(partner) && !cupidonPartners.has(partner)) {
          cupidonPartners.add(partner);
        }
      }
    }
  }
  for (const partner of cupidonPartners) {
    broadcast(room, {
      type: "drink_alert",
      targetClerkIds: [partner],
      emoji: "💘",
      action: "boire — lié au cœur",
    });
  }
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

export function checkTrigger(room: Room): boolean {
  const game = room.game;
  if (!game?.alcoholState) return false;

  const state = game.alcoholState;
  if (!state.config.enabled) return false;
  if (state.activeRound !== null) return false;

  state.turnsSinceLastSpecial += 1;

  if (state.turnsSinceLastSpecial < state.config.frequency) return false;

  // Refill queue if exhausted
  if (state.specialRoundQueue.length === 0) {
    state.specialRoundQueue = shuffleArray([...state.config.enabledRounds]);
  }

  const roundType = state.specialRoundQueue.shift() as SpecialRoundType;
  state.activeRound = roundType;
  state.turnsSinceLastSpecial = 0;

  const handler = roundRegistry.get(roundType);
  if (handler) {
    handler.start(room, state);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Message routing
// ---------------------------------------------------------------------------

export function handleAlcoholMessage(
  room: Room,
  clerkId: string,
  msg: ClientMessage,
): void {
  const game = room.game;
  if (!game?.alcoholState) return;

  const state = game.alcoholState;
  if (!state.activeRound) return;

  const handler = roundRegistry.get(state.activeRound);
  if (handler) {
    handler.handleMessage(room, state, clerkId, msg);
  }
}

// ---------------------------------------------------------------------------
// End special round
// ---------------------------------------------------------------------------

export function endSpecialRound(room: Room): void {
  const game = room.game;
  if (!game?.alcoholState) return;

  game.alcoholState.activeRound = null;
  broadcast(room, { type: "special_round_end" });
  if (_onRoundEnd) _onRoundEnd(room);
}

// ---------------------------------------------------------------------------
// Cul-sec end-of-game
// ---------------------------------------------------------------------------

export function handleCulSecEndGame(room: Room): void {
  const game = room.game;
  if (!game?.alcoholState?.config.culSecEndGame) return;

  const scores = game.scores;
  const playerIds = Array.from(room.players.keys());

  if (playerIds.length === 0) return;

  const minScore = Math.min(...playerIds.map((id) => scores[id] ?? 0));
  const losers = playerIds.filter((id) => (scores[id] ?? 0) === minScore);

  if (losers.length > 0) {
    broadcastDrinkAlert(
      room,
      losers,
      "🥃",
      "faire cul-sec — score le plus bas",
    );
  }
}
