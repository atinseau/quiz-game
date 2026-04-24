# Scenario: Drink alert — renders "C'est pour toi !" vs "C'est pour {name} !"

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** regression
**Spec:** drink-alert-personalization

## Preconditions

- 2 players connected in a multi room
- Alcohol mode enabled with `enabledRounds: ["conseil"]`, `frequency: 3`
- Conseil round has triggered

## Steps

1. Both players vote (each has only one available target — the other player)
   - **Expect:** 1-1 tie, routes through tiebreaker wheel, server picks one loser
2. Server broadcasts `drink_alert` with `{ targetClerkIds: [loserId], action: "boire une gorgée" }`
3. Each client renders the alert locally
   - **Expect (loser):** big white "C'est pour toi !" + amber "Boire une gorgée"
   - **Expect (observer):** big white "C'est pour {loserUsername} !" + amber "Boire une gorgée"

## Assertions

- [ ] Loser: `.text-2xl.font-bold` contains "C'est pour toi !"
- [ ] Observer: same class contains "C'est pour " followed by a name (not "toi")
- [ ] Both: `.text-lg.text-amber-400` contains "Boire une gorgée" (capitalized)
- [ ] Emoji visible: 🗳️

## Notes

This scenario is the minimal E2E check for Part A — the `drink_alert` payload refactor to
`{ targetClerkIds[], action }` with client-side self/observer differentiation. Other rounds
(Courage, Distributeur, Petit Buveur, etc.) use the same payload and inherit this behavior;
their existing scenarios are stale-flagged and re-verified post-migration.

The 2-player case always produces a 1-1 tie which routes through the tiebreaker wheel, but
the final `drink_alert` shape is identical to the mono-loser case, so this test incidentally
covers the wheel's final-alert integration without asserting on the wheel itself.
