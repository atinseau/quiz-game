import { broadcast } from "../rooms";
import type { Room } from "../types";
import { roundRegistry } from "./rounds";
import type { AlcoholConfig, AlcoholState, SpecialRoundType } from "./types";

// ---------------------------------------------------------------------------
// Callback wired by game-engine to avoid circular imports
// ---------------------------------------------------------------------------

let _onRoundEnd: ((room: Room) => void) | null = null;

export function setOnRoundEnd(cb: (room: Room) => void): void {
  _onRoundEnd = cb;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function shuffleArray<T>(arr: T[]): T[] {
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
  };
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
  msg: Record<string, unknown>,
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

  setTimeout(() => {
    if (_onRoundEnd) _onRoundEnd(room);
  }, 1000);
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

  for (const loserClerkId of losers) {
    broadcast(room, {
      type: "drink_alert",
      targetClerkId: loserClerkId,
      emoji: "🥃",
      message: "Cul-sec ! Tu as le score le plus bas !",
    });
  }
}
