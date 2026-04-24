# Scenario: Voleur — main wrong ends the turn (no more stealing)

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** regression
**Spec:** multi-repro-voleur-main-wrong-closes-turn

## Preconditions

- URL: /play
- Required mocks: packs.json, questions-pack-test.json, audio files
- Initial state: Two players in a voleur game, first question visible

## Steps

1. Main answers incorrectly (via WS)
   - **Do:** `submitAnswerViaWs(main, wrongAnswer)`
   - **Expect:** turn_result broadcast immediately; both pages show a wrong-answer feedback

2. Stealer tries to submit the correct answer after main closed the turn
   - **Do:** `submitAnswerViaWs(stealer, correctAnswer)`
   - **Expect:** no-op — the server already resolved the turn, so the message is ignored

3. Neither page shows a successful-steal feedback
   - **Do:** check for /Vol réussi/ and /volé la réponse/
   - **Expect:** neither is visible — the turn is just a plain miss, not a steal

## Assertions

- [ ] Main wrong resolves the turn immediately (no wait for stealers)
- [ ] Stealer who submits after main wrong gets nothing and no steal feedback appears
- [ ] If a stealer had already submitted a wrong answer before main, they eat `STEAL_FAIL_PENALTY`

## Notes

**Design rationale:** the whole point of the voleur mode is "beat main to the correct answer". If main wrong were to open a steal window, stealers would learn "main is wrong → there's still a correct answer to grab" and the mode becomes trivial risk-free guessing after a failure signal. Closing the turn on main wrong keeps stealing honest: you win by being fast, not by reacting to main's mistake.

Server fix lives in `apps/client/src/server/game-engine.ts resolveVoleur`. Unit coverage: `src/server/game-engine.test.ts "main wrong ends the turn immediately" suite`.
