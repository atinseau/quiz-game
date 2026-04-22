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
   - **Expect:** Drink alert with "gorgée" text appears

4. Fallback when not the distributor
   - **Do:** Observe overlay content
   - **Expect:** "Distributeur !" text + "gorgée" text visible

## Assertions

- [ ] Distributeur overlay visible after 3 turns
- [ ] Distributor can distribute 3 drinks by clicking a player button
- [ ] Drink alert message mentions "gorgée"

## Notes

Solo mode treats null myClerkId as the solo distributor (fix committed de79160).
