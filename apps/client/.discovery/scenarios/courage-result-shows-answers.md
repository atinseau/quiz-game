# Scenario: Courage — result overlay shows answers

**Status:** covered
**Priority:** high
**Page:** multi-game
**Domain:** regression
**Spec:** multi-repro-courage-result-shows-answers

## Preconditions

- 2 players in a multi classic game, on /game
- Alcohol enabled, frequency 1, only `courage` in enabled rounds

## Steps

1. Host triggers the special round by submitting an answer via WS.
2. Wait for the courage overlay to appear.
3. Detect which player was picked (`"J'accepte !"` button visible) via
   `Promise.any`.
4. Chosen player clicks accept, types a deliberately wrong answer,
   submits via "Valider".

## Assertions

- [x] Both players see a fullscreen DrinkAlert (button.fixed.inset-0).
- [x] The DrinkAlert contains the "CUL SEC !" message AND the wrong
      answer (line-through red) AND "Bonne réponse :" label + correct
      answer (green).
- [x] All assertions are scoped inside the DrinkAlert locator (proves the
      info is ON TOP, not occluded).

## Notes

Before fix: `courage_result` broadcast only carried `{ correct,
pointsDelta }`. The client rendered a generic "Mauvaise réponse !" card,
but the fullscreen DrinkAlert (z-100) with only the CUL SEC message
covered it — players never saw the submitted or correct answer.

Fix: extended the shared `drink_alert` message with a typed,
discriminated `details?: DrinkAlertDetails` (`kind: "courage"` today,
extensible). Server sends given/correct answer inside the alert. Client
`<DrinkAlert>` delegates to a per-kind renderer in
`components/alcohol/drink-alert-details/` — exhaustive `never` check
forces compile errors if a new kind is added without a renderer.

Round stays at 4s total (no added friction), everyone reads the shame
+ truth inside a single animated overlay.
