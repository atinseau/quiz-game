# Scenario: Conseil du village — tie triggers the fortune wheel

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** regression
**Spec:** multi-repro-conseil-tie-wheel

## Preconditions

- 3 players connected in a multi room
- Alcohol mode enabled with `enabledRounds: ["conseil"]`, `frequency: 3`
- The Conseil special round has triggered after 3 answered questions

## Steps

1. Each of the 3 players clicks a different vote target so votes split 3 ways
   - **Expect:** overlay "Égalité !" appears on all 3 clients (~1.5s auto-advance)
2. Fortune wheel renders with N slices — one per tied player
   - **Expect:** `<svg aria-label="Roue de la fortune">` visible, rotates ~4s decelerating (cubic-bezier ease-out), ~5 full rotations
3. After reveal (1.5s) + spin (4s) + settle (0.8s), the server fires a single `drink_alert`
   - **Expect:** `conseil_tiebreaker` WS frame received by all clients with identical `selectedClerkId`
4. Drink alert displays the server's pick
   - **Expect:** selected player sees "C'est pour toi !" + "Boire une gorgée"; the other 2 see "C'est pour {name} !"

## Assertions

- [ ] Overlay "Égalité !" visible with N amber pastilles (one per tied player)
- [ ] `<svg aria-label="Roue de la fortune">` present during spin phase
- [ ] Exactly ONE client shows "C'est pour toi !"
- [ ] The other N-1 clients show "C'est pour {loserName} !"
- [ ] Round ends cleanly (no stuck overlay, next question appears)

## Notes

Server picks via `shuffleArray(loserClerkIds)[0]` — deterministic in unit tests where
`Math.random` is mocked. E2E does not assert WHICH specific player wins, only that the
tie resolves to exactly one loser and the drink alert renders correctly on both sides.
