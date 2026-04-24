# Scenario: Distributeur — solo flow

**Status:** covered
**Priority:** high
**Page:** game
**Domain:** solo
**Spec:** alcohol-distributeur-solo

## Preconditions

- URL: /play/solo (auth bypass)
- Required mocks: Strapi packs API
- Initial state: alcohol mode enabled, frequency 3, rounds=[distributeur], 2 players (Alice, Bob)

## Steps

1. Start solo game with distributeur round only
   - **Do:** `startSoloAlcoholGame(page, { players: ["Alice", "Bob"], mode: "Classique", frequency: 3, enabledRounds: ["distributeur"] })`
   - **Expect:** Game starts normally

2. Play 3 turns and wait for overlay
   - **Do:** `playTurnsSolo(page, 3)` then `waitForRoundOverlay(page, "distributeur")`
   - **Expect:** "Distributeur !" overlay visible within 15s

3. Distribute drinks (if acting as distributor)
   - **Do:** Click Bob's player button 3 times
   - **Expect:** Drink alert overlay appears with the action line "Boire — envoyé par Alice"

4. Fallback when not the distributor
   - **Do:** Observe overlay content
   - **Expect:** "Distributeur !" overlay + personalized verdict ("C'est pour Bob !") + action line "Boire — envoyé par Alice"

## Assertions

- [ ] Distributeur overlay visible after 3 turns
- [ ] Distributor can distribute 3 drinks by clicking a player button
- [ ] Drink alert action line contains "envoyé par" (distributor name)

## Notes

Solo mode treats null myClerkId as the solo distributor (fix committed de79160).

Post Part A (2026-04-24): the drink alert payload is
`{ targetClerkIds: [target], emoji: "🍺", action: "boire — envoyé par {distributor}" }`.
The action string preserves the distributor's name — this is the only context
the receiver has to know who targeted them. Action renders capitalized
("Boire — envoyé par Alice"). The substring "gorgée" is no longer in the
action (it was removed when the verb was generalized across rounds).
