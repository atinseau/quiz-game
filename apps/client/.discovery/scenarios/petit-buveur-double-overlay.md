# Scenario: Petit Buveur — single overlay only

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** regression
**Spec:** multi-repro-petit-buveur-double-overlay

## Preconditions

- Multi game started, 2 players in /game
- Alcohol enabled, frequency 1, only `petit_buveur` in enabled rounds

## Steps

1. Host submits `__WRONG_ANSWER__` via WS to keep scores 0-0.
2. petit_buveur triggers after turn resolution.

## Assertions

- [x] Exactly one `<DrinkAlert>` (button.fixed.inset-0) is visible during the round.
- [x] No "Petit buveur !" card is rendered behind the DrinkAlert.
- [x] Second test: bounce-in animation does NOT replay for each tied loser (single aggregated message).

## Notes

Previous bug: `special_round_start` mounted a PetitBuveur card (z-90) while
`drink_alert` mounted the fullscreen overlay (z-100). User saw the alert,
it auto-dismissed at 4s, the card underneath was then revealed → two
sequential notifications for the same event.

Fix: removed petit_buveur from `clientRoundRegistry` + aggregated multiple
losers/Cupidon partners into a single drink_alert payload
(`{ targetClerkIds: [loser1, loser2, ...], action: "boire une gorgée" }`
after Part A). Round timers aligned to 4s on both client (solo) and
server (multi) to avoid stale UI gap.

Post Part A (2026-04-24): the rendered text depends on `myClerkId`:
a loser sees "C'est pour toi !" + "(+ {other losers})" (when multiple)
and a non-loser observer sees "C'est pour {joinNames(names)} !" (e.g.
"C'est pour A et B !"). Both show the amber action line "Boire une gorgée".
