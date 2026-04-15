# Scenario: Voleur — main correct ends turn immediately

**Status:** discovered
**Priority:** critical
**Page:** multi-game
**Domain:** e2e
**Spec:** multi-voleur-flow

## Preconditions

- URL: /play
- Required mocks: packs.json, questions-pack-test.json, audio files
- Initial state: Two players in a voleur game, first question visible

## Steps

1. Main responder answers correctly
   - **Do:** Submit correct answer via WS for the main player only (guest does NOT answer)
   - **Expect:** Turn resolves immediately — turn_result appears with correct answer

2. Turn result is visible without waiting for stealer
   - **Do:** Check for feedback box on both players
   - **Expect:** Correct answer feedback is shown to both, stealer never got a chance to answer

## Assertions

- [ ] When main player answers correctly, turn_result appears without waiting for other players
- [ ] Correct answer feedback is shown to all players
- [ ] Main player gets +1 point

## Notes

Previously, the server waited for all stealers even when the main was correct. Now `resolveVoleur` returns immediately on `mainCorrect`.
