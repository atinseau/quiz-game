# Scenario: Player leave — 2 players aborts game

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** regression
**Spec:** multi-repro-player-leave-2-players

## Preconditions

- 2 players in a multi classic game, on /game
- Both pages fully loaded (first question rendered)

## Steps

1. Guest sends `{ type: "leave_room" }` via WS.
2. Server removes the player + triggers `onPlayerLeft`.

## Assertions

- [x] Host navigates away from `/game` (to `/play` or `/`) within 8s.
- [x] Game state is torn down (room cleared, game reset).

## Notes

Before fix: server broadcast `player_left` and shrank `room.players`, but
nothing ended the game. The remaining player stayed stuck on `/game` with
broken rotation / score UI.

Fix: new `onPlayerLeft(room, leftClerkId)` in game-engine.ts checks
`room.players.size < 2` and broadcasts `game_aborted` + tears the game
down (status back to lobby, timers cleared). Client handler on
`game_aborted` resets state and navigates to `/play`.

Also wired into the 60s grace-expiry path in `handleDisconnect`.
