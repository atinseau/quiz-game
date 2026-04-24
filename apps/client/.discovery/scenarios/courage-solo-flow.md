# Scenario: Question de courage — solo flow

**Status:** covered
**Priority:** critical
**Page:** game
**Domain:** solo
**Spec:** alcohol-courage-solo

## Preconditions

- URL: /play/solo (auth bypass)
- Required mocks: Strapi packs API
- Initial state: alcohol mode enabled, frequency 3, rounds=[courage], 1 player

## Steps

1. Start solo alcohol game
   - **Do:** `startSoloAlcoholGame(page, { players: ["Alice"], mode: "Classique", frequency: 3, enabledRounds: ["courage"] })`
   - **Expect:** Game starts normally

2. Play 3 turns and wait for overlay
   - **Do:** `playTurnsSolo(page, 3)` then `waitForRoundOverlay(page, "courage")`
   - **Expect:** Courage overlay visible within 10s

3. Accept the challenge
   - **Do:** Click "J'accepte !"
   - **Expect:** Text input "Ta réponse..." appears

4. Submit a response
   - **Do:** Fill input + Enter
   - **Expect:** Result text or drink alert appears (matches /boit|gorgée|cul sec|moitié|défi|bonne réponse|mauvaise réponse|relevé/i)

## Assertions

- [ ] Courage overlay visible after 3 turns
- [ ] "J'accepte !" button reveals input
- [ ] Submitting an answer resolves the round

## Notes

Countdown auto-refuse behavior is covered separately by FIX #6 logic (10s countdown).

Post Part A (2026-04-24): solo courage drink alert action is now "défi relevé"
(renders as "Défi relevé" after capitalize). Refusal path uses "boire la moitié
du verre — refus". The regex is now case-insensitive and includes "relevé" to
match the new action phrasing; "a répondu au défi" was removed.
