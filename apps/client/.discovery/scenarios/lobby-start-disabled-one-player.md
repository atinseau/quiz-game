# Scenario: Lobby — "Lancer la partie" disabled with 1 player

**Status:** covered
**Priority:** high
**Page:** lobby
**Domain:** multi
**Spec:** multi-lobby

## Preconditions

- Host on /play (auth bypass + WS testUser override)
- Required mocks: Strapi packs API, Clerk auth, WS user override, mock Strapi on :1337
- Initial state: host just created a room, no guest has joined

## Steps

1. Host creates a room
   - **Do:** `setTestUser(host, "Alice")`, `hostCreatesRoom(host)`
   - **Expect:** Navigate to /play/lobby/{code}, "Joueurs (1/1)" visible

2. Inspect start button
   - **Do:** Read "Lancer la partie" button state
   - **Expect:** Button has `[disabled]` attribute

3. Verify warning message
   - **Do:** Read paragraph under the start button
   - **Expect:** Text "Il faut au moins 2 joueurs" visible

## Assertions

- [x] "Joueurs (1/1)" label visible when alone
- [x] "Lancer la partie" button is disabled
- [x] "Il faut au moins 2 joueurs" message visible

## Notes

Validated live on 2026-04-20 via playwright-cli. UI exposes the guard cleanly.
