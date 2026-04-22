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

1. Main responder answers incorrectly
   - **Do:** Submit wrong answer via WS for the main player
   - **Expect:** Inputs remain open for stealer

2. Stealer answers correctly
   - **Do:** Submit correct answer via WS for the other player
   - **Expect:** Turn resolves — steal is successful

3. Stealer sees amber "Vol reussi" feedback
   - **Do:** Check stealer's feedback box
   - **Expect:** Amber/orange box with "Vol reussi" text and Zap icon

4. Main player sees amber "t'a vole la reponse" feedback
   - **Do:** Check main player's feedback box
   - **Expect:** Amber/orange box with "{stealer} t'a vole la reponse" text

## Assertions

- [ ] Successful steal shows amber feedback (not green/red)
- [ ] Stealer sees "Vol reussi" message
- [ ] Main player sees "{stealer} t'a vole la reponse" message
- [ ] Amber box uses border-amber-500 styling

## Notes

In solo mode, the steal box was already amber. This verifies the multi-device implementation matches.
