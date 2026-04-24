# Scenario: Voleur — stealer correct FIRST ends turn immediately (steal confirmed)

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** regression
**Spec:** multi-repro-voleur-stealer-first

## Preconditions

- URL: /play
- Required mocks: packs.json, questions-pack-test.json, audio files
- Initial state: Two players in a voleur game, first question visible. Main responder and stealer both have enabled inputs.

## Steps

1. Both players see the first question with inputs enabled
   - **Do:** identify main + stealer via "Réponds en premier" / "Tente de voler" cue
   - **Expect:** both have enabled answer inputs

2. Stealer answers correctly BEFORE the main responder
   - **Do:** `submitAnswerViaWs(stealer, correctAnswer)` only; the main player does NOT answer
   - **Expect:** turn should resolve immediately as a successful steal ("c'est un vol")

3. Turn result is visible to both players
   - **Do:** check feedback on both screens
   - **Expect:** stealer sees "Vol réussi"; main sees "{stealer} t'a volé la réponse"; scores updated (stealer +STEAL_GAIN, main -STEAL_LOSS)

## Assertions

- [ ] When stealer answers correctly first, turn_result is broadcast without waiting for main
- [ ] Steal is marked successful (`stole: true`, `correct: true` for stealer in playerResults)
- [ ] Stealer gets +STEAL_GAIN points, main gets -STEAL_LOSS
- [ ] Main's inputs become disabled after turn_result (they never answered)

## Notes

**Was bug:** `resolveVoleur` returned early at `if (!game.answers.has(mainPlayerId)) return;` whenever the main responder hadn't answered yet. The stealer's correct answer was stored in `game.answers` but never evaluated until the main player answered. If main then answered correctly, main won (+1) and the stealer's steal was silently dropped.

**Fix:** `resolveVoleur` now computes `stealerWon` before anything else. If any non-main connected player has an answer that `checkAnswer` accepts, the turn resolves immediately as a successful steal — `stealerWon` takes priority over the main-correct branch, and main's `PlayerResult` is emitted with `answered: mainHasAnswered` (false when main never got a chance). Covered by `src/server/game-engine.test.ts` and the Playwright regression `tests/e2e/regression/multi-repro-voleur-stealer-first.spec.ts`.
