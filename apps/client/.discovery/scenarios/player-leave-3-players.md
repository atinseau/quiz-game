# Scenario: Player leave — 3 players keeps playing

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** regression
**Spec:** multi-repro-player-leave-3-players

## Preconditions

- 3 players (Alice host, Bob, Charlie) in a multi classic game on /game
- Uses an ad-hoc trio fixture (extends base test with 3 browser contexts)

## Steps

### Pathological case
1. Alice is the current player (currentPlayerIndex=0 after start).
2. Alice sends `{ type: "leave_room" }` BEFORE answering.
3. Expect: the turn forcibly resolves, next question arrives for Bob/Charlie.

### Non-current case
1. Charlie (non-current) leaves.
2. Expect: Alice + Bob stay on /game, rotation continues seamlessly, one of
   them answers and the question advances.

## Assertions

- [x] Remaining players stay on `/game` (no forced navigation).
- [x] Question text changes on remaining players after the leave.
- [x] Scoreboard drops the departed player.

## Notes

Before fix: `advanceToNextConnectedPlayer` fallback skipped disconnected
players, but if the CURRENT player left mid-turn, `game.answers` never
completed → turn permanently stuck.

Fix: `onPlayerLeft` force-resolves the turn (`game.resolved = true`) and
calls `scheduleNextQuestion` if no remaining player has submitted an
answer yet. Covers both `leave_room` and post-grace disconnect.
