# Scenario: Alcohol mode triggers special round in multi

**Status:** covered
**Priority:** high
**Page:** multi-game
**Domain:** multi
**Spec:** multi-alcohol-flow

## Preconditions

- URL: /play/lobby/{code} for host, /play/join for guest
- Required mocks: Strapi packs API, Clerk auth for host
- Initial state: multi game started with frequency 3, rounds [petit_buveur, distributeur, courage], Cul sec end-game enabled

## Steps

1. Start multi alcohol game
   - **Do:** `startMultiAlcoholGame(host, guest, { frequency: 3, enabledRounds, culSecEndGame: true })`
   - **Expect:** Question UI visible for host, both peers synchronized

2. Play 3 turns
   - **Do:** `playTurnsMulti(host, guest, 3)`
   - **Expect:** After the 3rd turn, a special round or drink alert appears on at least one screen

3. Verify overlay or alert
   - **Do:** Wait for text matching /Petit buveur|Distributeur|Question de courage|boit une gorgée|gorgée|CUL SEC|moitié du verre/
   - **Expect:** Text visible on host or guest within 15s

## Assertions

- [ ] Special round pattern visible on at least one device after 3 turns
- [ ] Both peers remain in-sync for the special round

## Notes

Multi helper fixtures live in `tests/helpers/alcohol-fixtures.ts` and `tests/helpers/multi-fixtures.ts`.
