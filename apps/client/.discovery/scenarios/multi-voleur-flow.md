# Scenario: Multi-device voleur flow

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** multi
**Spec:** multi-voleur-flow

## Preconditions

- Host + guest on /play (auth bypass)
- Required mocks: Strapi packs API, Clerk auth, WS user override
- Initial state: both devices ready to create/join

## Steps

1. Create and join room
   - **Do:** `setTestUser`, `hostCreatesRoom`, `guestJoinsRoom`
   - **Expect:** Lobby shows both players

2. Start voleur game
   - **Do:** `hostSelectsPack`, `hostSelectsMode(host, "voleur")`, `hostStartsGame`
   - **Expect:** Navigate to /game, voleur UI visible

3. Trigger a steal
   - **Do:** Main player answers wrong → other player triggers steal via their screen
   - **Expect:** Steal zone and confirmation flow work across devices

4. Resolve steal and continue game
   - **Do:** Validate or refuse steal, advance
   - **Expect:** Scores update server-side, both devices remain synchronized

## Assertions

- [ ] Voleur steal zone appears after wrong answer
- [ ] Steal confirmation syncs host + guest
- [ ] Scores update correctly on both devices

## Notes

Steal edge cases (input lock, main correct instant, amber feedback) are covered by separate discovered scenarios.
