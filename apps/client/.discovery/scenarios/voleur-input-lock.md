# Scenario: Voleur — inputs lock on turn resolution

**Status:** discovered
**Priority:** high
**Page:** multi-game
**Domain:** e2e
**Spec:** multi-voleur-flow

## Preconditions

- URL: /play
- Required mocks: packs.json, questions-pack-test.json, audio files
- Initial state: Two players in a voleur game, first question visible

## Steps

1. Both players see the question with inputs enabled
   - **Do:** Check that both host and guest have enabled answer buttons
   - **Expect:** Both players can interact with answer inputs

2. Main responder answers correctly via WS
   - **Do:** Submit correct answer via WebSocket for the main player
   - **Expect:** turn_result is broadcast, correct answer is shown

3. Non-main player's inputs are now disabled
   - **Do:** Check the other player's answer buttons
   - **Expect:** Inputs are disabled (they can no longer submit)

## Assertions

- [ ] Before resolution, both players have enabled inputs
- [ ] After turn_result, non-answering player's inputs become disabled
- [ ] Correct answer is visible to all players after resolution

## Notes

This tests the `game.turnResult !== null` guard added to `inputDisabled`.
