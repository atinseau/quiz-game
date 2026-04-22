# Scenario: Multi-device chrono flow

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** multi
**Spec:** multi-chrono-flow

## Preconditions

- Host + guest on /play (auth bypass)
- Required mocks: Strapi packs API, Clerk auth, WS user override
- Initial state: both devices ready to create/join
- Test timeout extended to 90s to allow a 15s chrono timeout

## Steps

1. Create and join room
   - **Do:** `setTestUser` for both, `hostCreatesRoom`, `guestJoinsRoom`
   - **Expect:** Host lobby shows guest

2. Host selects chrono mode and starts
   - **Do:** `hostSelectsPack`, `hostSelectsMode(host, "chrono")`, `hostStartsGame`
   - **Expect:** Both devices navigate to /game

3. Play through questions, allowing at least one timeout
   - **Do:** Loop answering via `answerViaUI`, intentionally let one turn expire (15s)
   - **Expect:** Timer counts down, timeout feedback appears on at least one device

4. Reach end
   - **Do:** Continue until /end or "Fin de la partie" visible
   - **Expect:** Game ends with leaderboard

## Assertions

- [ ] Chrono timer visible and counting
- [ ] Timeout is handled server-side (15s)
- [ ] Game completes at /end

## Notes

Server enforces the 15s chrono timeout. The test exercises one forced timeout to cover the server path.
