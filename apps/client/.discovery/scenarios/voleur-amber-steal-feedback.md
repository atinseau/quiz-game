# Scenario: Voleur — amber steal feedback box

**Status:** discovered
**Priority:** high
**Page:** multi-game
**Domain:** multi
**Spec:** multi-voleur-flow

## Preconditions

- URL: /play
- Required mocks: packs.json, questions-pack-test.json, audio files
- Initial state: Two players in a voleur game, first question visible

## Steps

1. Stealer answers correctly BEFORE the main responder
   - **Do:** Submit correct answer via WS for the stealer only
   - **Expect:** Turn resolves immediately — steal is successful

2. Stealer sees amber "Vol reussi" feedback
   - **Do:** Check stealer's feedback box
   - **Expect:** Amber/orange box with "Vol reussi" text and Zap icon

3. Main player sees amber "t'a vole la reponse" feedback
   - **Do:** Check main player's feedback box
   - **Expect:** Amber/orange box with "{stealer} t'a vole la reponse" text

## Assertions

- [ ] Successful steal shows amber feedback (not green/red)
- [ ] Stealer sees "Vol reussi" message
- [ ] Main player sees "{stealer} t'a vole la reponse" message
- [ ] Amber box uses border-amber-500 styling

## Notes

Only the "stealer beats main" path can trigger a steal under the current rules — main wrong now closes the turn immediately (see `voleur-main-wrong-closes-turn.md`). In solo mode, the steal box was already amber; this verifies the multi-device implementation matches the same styling.
